import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const dbRequire = createRequire(new URL('../../../lib/db/package.json', import.meta.url));
const { generateDrizzleJson, generateMigration } = dbRequire('drizzle-kit/api');

// Real route + real development DB, with auth/storage injected at the boundary.
// No Clerk secrets or external objects are created by this regression suite.
test('photo-first API contract, persistence, ownership and historical photos', async () => {
  const output = new URL(`../node_modules/.cache/community-${randomUUID()}.mjs`, import.meta.url);
  const result = await build({
    stdin: { contents: `
      export { default as routes } from './src/routes/builds';
      export { default as storageRoutes } from './src/routes/storage';
      export * from '../../lib/db/src/index';
      export * from '../../lib/api-zod/src/index';
      export { validStoredPhoto } from './src/lib/photoValidation';
      export { default as express } from 'express';
      export { eq } from 'drizzle-orm';
      export { storageEvents, failedDeletes } from './src/lib/objectStorage';
    `, resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', external:['pg-native'], write: false,
    banner: { js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    alias: {
      '@workspace/api-zod': new URL('../../../lib/api-zod/src/index.ts', import.meta.url).pathname,
      '@workspace/db': new URL('../../../lib/db/src/index.ts', import.meta.url).pathname,
    },
    plugins: [{
      name: 'test-boundaries',
      setup(b) {
        b.onResolve({ filter: /^@clerk\/express$/ }, () => ({ path: 'clerk-test', namespace: 'test-auth' }));
        b.onLoad({ filter: /.*/, namespace: 'test-auth' }, () => ({ contents: `
          export const getAuth = req => ({ userId: req.headers['x-test-user'] || null });
        `, loader: 'js' }));
        b.onLoad({ filter: /\/lib\/auth\.ts$/ }, () => ({ contents: `
          export const getCurrentUserId = req => req.headers['x-test-user'] || null;
        `, loader: 'js' }));
        b.onLoad({ filter: /\/lib\/objectStorage\.ts$/ }, () => ({ contents: `
          export const storageEvents = [];
          export const failedDeletes = new Set();
          export class ObjectNotFoundError extends Error {}
          export class ObjectStorageService {
            async getObjectEntityFile(path) {
              return { delete: async () => {
                storageEvents.push(['delete', path]);
                if (failedDeletes.has(path)) throw new Error('Injected storage failure');
              }, getMetadata: async () => [{
                size: path.includes('oversize') ? '12000001' : '120',
                contentType: path.includes('wrongtype') ? 'text/html' : 'image/jpeg'
              }] };
            }
            async trySetObjectEntityAclPolicy(path, policy) { storageEvents.push([policy.visibility, path]); }
            async canAccessObjectEntity() { return true; }
            async downloadObject() { return new Response('photo', { headers: { 'Content-Type':'image/jpeg' } }); }
          }
        `, loader: 'js' }));
      },
    }],
  });
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, result.outputFiles[0].text);
  const m = await import(output.href);
  const { db, pool, profilesTable, buildsTable, uploadReservationsTable, favouritesTable, photoDeletionsTable, eq } = m;
  const suffix = randomUUID().slice(0, 8);
  const owner = `photo-test-${suffix}`;
  const noUsername = `${owner}-new`;
  const blueprint = { size:'standard', color:'#123456', shelfDirections:Array(9).fill('L'), wallColor:'#abcdef', floorId:'custom', floorKind:'Carpet', customFloorColor:'#654321' };
  const paths = Array.from({ length:5 }, (_, i) => `/objects/uploads/${suffix}-${i}`);
  const app = m.express();
  app.use(m.express.json());
  app.use((req, _res, next) => { req.log = { error() {} }; next(); });
  app.use(m.routes);
  app.use(m.storageRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const request = (path, method = 'GET', data, user) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers:{ 'Content-Type':'application/json', ...(user ? { 'x-test-user':user } : {}) },
    ...(data ? { body:JSON.stringify(data) } : {}),
  });
  try {
    // Exercise the merge-time Drizzle migration on a populated pre-change
    // schema, never on the user's public tables.
    const schemaExports = { buildsTable, profilesTable, uploadReservationsTable };
    const columns = [buildsTable.colorName, buildsTable.colorHex, buildsTable.configuration];
    columns.forEach((column) => { column.notNull = true; });
    const before = generateDrizzleJson(schemaExports);
    columns.forEach((column) => { column.notNull = false; });
    const after = generateDrizzleJson(schemaExports);
    const migration = await generateMigration(before, after);
    assert.equal(migration.length, 3);
    for (const statement of migration) assert.match(statement, /ALTER TABLE "builds" ALTER COLUMN "(color_name|color_hex|configuration)" DROP NOT NULL/);
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const schemaName = `photo_migration_${suffix.replaceAll('-', '')}`;
      await connection.query(`CREATE SCHEMA "${schemaName}"`);
      await connection.query(`SET LOCAL search_path TO "${schemaName}"`);
      await connection.query(`CREATE TABLE builds (
        title text NOT NULL, photo_paths text[] NOT NULL,
        color_name text NOT NULL, color_hex text NOT NULL,
        configuration jsonb NOT NULL
      )`);
      await connection.query('INSERT INTO builds VALUES ($1, $2, $3, $4, $5)', ['Historical room', paths, 'Coal', '#123456', blueprint]);
      for (const statement of migration) await connection.query(statement);
      await connection.query('INSERT INTO builds VALUES ($1, $2, NULL, NULL, NULL)', ['Photo-only room', [paths[0]]]);
      const migrated = await connection.query('SELECT * FROM builds ORDER BY title');
      assert.deepEqual(migrated.rows[0].photo_paths, paths);
      assert.deepEqual(migrated.rows[0].configuration, blueprint);
      assert.equal(migrated.rows[1].configuration, null);
      assert.equal(migrated.rows[1].color_hex, null);
      assert.equal(migrated.rows.length, 2);
    } finally {
      await connection.query('ROLLBACK');
      connection.release();
    }
    await db.insert(profilesTable).values([
      { userId:owner, username:owner, usernameKey:owner },
      { userId:noUsername },
    ]);
    await db.insert(uploadReservationsTable).values([...paths, `/objects/uploads/${suffix}-oversize`, `/objects/uploads/${suffix}-wrongtype`].map((objectPath) => ({
      userId:owner, objectPath, size:120, contentType:'image/jpeg', fileName:'room.jpg',
    })));
    const input = { title:'Test room', photoPaths:[paths[0]] };
    assert.equal(m.CreateBuildBody.safeParse(input).success, true);
    assert.equal(m.CreateBuildBody.safeParse({ ...input, configuration:null }).success, true);
    assert.equal(m.CreateBuildBody.safeParse({ ...input, photoPaths:paths }).success, false);
    assert.equal(m.UpdateBuildBody.safeParse({ photoPaths:paths }).success, false);
    for (const size of [1, 12000000]) assert.equal(m.RequestUploadUrlBody.safeParse({ name:'a.jpg', size, contentType:'image/jpeg' }).success, true);
    for (const size of [0, 12000001]) assert.equal(m.RequestUploadUrlBody.safeParse({ name:'a.jpg', size, contentType:'image/jpeg' }).success, false);
    assert.equal(m.RequestUploadUrlBody.safeParse({ name:'a.svg', size:1, contentType:'image/svg+xml' }).success, false);
    assert.equal(m.validStoredPhoto({ size:120, contentType:'image/jpeg' }, { size:'120', contentType:'image/jpeg' }), true);
    assert.equal(m.validStoredPhoto({ size:120, contentType:'image/jpeg' }, { size:'121', contentType:'image/jpeg' }), false);
    assert.equal((await request('/builds', 'POST', input)).status, 401);
    assert.equal((await request('/builds', 'POST', input, noUsername)).status, 400);
    assert.equal((await request('/builds', 'POST', { ...input, photoPaths:[paths[0], paths[0]] }, owner)).status, 400);
    for (const bad of ['oversize', 'wrongtype']) {
      assert.equal((await request('/builds', 'POST', { ...input, photoPaths:[`/objects/uploads/${suffix}-${bad}`] }, owner)).status, 400);
    }
    const created = await request('/builds', 'POST', input, owner);
    assert.equal(created.status, 201);
    const photo = await created.json();
    assert.equal(photo.configuration, null);
    assert.equal(photo.colorHex, null);
    assert.deepEqual(photo.tags, []);
    assert.equal((await request(`/builds/${photo.id}`)).status, 200);
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { title:'Other' }, noUsername)).status, 404);
    assert.equal((await request(`/builds/${photo.id}`, 'DELETE', null, noUsername)).status, 404);
    const attached = await request(`/builds/${photo.id}`, 'PATCH', { configuration:blueprint }, owner);
    assert.deepEqual((await attached.json()).configuration, blueprint);
    const detached = await request(`/builds/${photo.id}`, 'PATCH', { configuration:null }, owner);
    assert.equal((await detached.json()).configuration, null);
    // Simulate a historical post; metadata-only edits must not truncate it.
    await db.update(buildsTable).set({ photoPaths:paths }).where(eq(buildsTable.id, photo.id));
    const legacy = await request(`/builds/${photo.id}`, 'PATCH', { description:'Still five photos' }, owner);
    assert.equal((await legacy.json()).photoPaths.length, 5);
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { photoPaths:paths }, owner)).status, 400);
    const replaced = await request(`/builds/${photo.id}`, 'PATCH', { photoPaths:paths.slice(0, 4) }, owner);
    assert.equal((await replaced.json()).photoPaths.length, 4);
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { photoPaths:['/objects/uploads/not-owned'] }, owner)).status, 400);
    const configured = await request('/builds', 'POST', { ...input, configuration:blueprint }, owner);
    assert.equal(configured.status, 201);
    const configPost = await configured.json();
    assert.deepEqual(configPost.configuration, blueprint);
    // Canonical owner listing is independent of public feed limits and usernames.
    await db.insert(buildsTable).values(Array.from({ length: 45 }, (_, i) => ({
      userId: owner, title: `Older room ${i}`, photoPaths: [paths[0]],
    })));
    await db.update(profilesTable).set({ username:`renamed-${suffix}`, usernameKey:`renamed-${suffix}` }).where(eq(profilesTable.userId, owner));
    assert.equal((await request('/profiles/me/builds')).status, 401);
    assert.equal((await request('/profiles/me/favourites')).status, 401);
    assert.equal((await request('/profiles/me/photo-cleanup', 'POST')).status, 401);
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'PUT')).status, 401);
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'DELETE')).status, 401);
    let cursor;
    const own = [];
    do {
      const response = await request(`/profiles/me/builds${cursor ? `?cursor=${cursor}` : ''}`, 'GET', null, owner);
      assert.match(response.headers.get('cache-control'), /no-store/);
      const page = await response.json();
      assert.ok(page.items.every((b) => b.creatorUsername === `renamed-${suffix}` && b.isOwner));
      own.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(own.length, 47);
    assert.equal(new Set(own.map((b) => b.id)).size, 47);
    assert.deepEqual((await (await request('/profiles/me/builds', 'GET', null, noUsername)).json()).items, []);
    // Saving requires authentication, not a configured username.
    const saves = await Promise.all(Array.from({ length: 8 }, () => request(`/builds/${photo.id}/favourite`, 'PUT', null, noUsername)));
    assert.ok(saves.every((r) => r.status === 204));
    const saved = await (await request('/profiles/me/favourites', 'GET', null, noUsername)).json();
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].isFavourite, true);
    assert.equal(saved.items[0].photoPaths.length, 4);
    assert.deepEqual((await (await request('/profiles/me/favourites', 'GET', null, owner)).json()).items, []);
    assert.equal((await (await request(`/builds/${photo.id}`, 'GET', null, noUsername)).json()).isFavourite, true);
    assert.equal((await (await request(`/builds/${photo.id}`)).json()).isFavourite, false);
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'DELETE', null, owner)).status, 204);
    assert.equal((await (await request('/profiles/me/favourites', 'GET', null, noUsername)).json()).items.length, 1);
    // Explicit removal preserves unlimited historical sets and optional blueprints.
    await db.update(buildsTable).set({ photoPaths: paths, configuration: blueprint }).where(eq(buildsTable.id, photo.id));
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { removePhotoPaths:[paths[4]] })).status, 401);
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { removePhotoPaths:[paths[4]] }, noUsername)).status, 404);
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { removePhotoPaths:['not-attached'] }, owner)).status, 400);
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { removePhotoPaths:[paths[4]], photoPaths:[paths[0]] }, owner)).status, 400);
    m.failedDeletes.add(paths[4]);
    const removed = await request(`/builds/${photo.id}`, 'PATCH', { removePhotoPaths:[paths[4]] }, owner);
    assert.equal(removed.status, 200);
    const remaining = await removed.json();
    assert.deepEqual(remaining.photoPaths, paths.slice(0, 4));
    assert.deepEqual(remaining.configuration, blueprint);
    // A failed ACL/object deletion cannot leave an unreferenced photo publicly readable.
    assert.equal((await request(`/storage${paths[4]}`)).status, 404);
    assert.equal((await (await request('/profiles/me/builds', 'GET', null, owner)).json()).cleanupPending, 1);
    assert.equal((await (await request('/profiles/me/photo-cleanup', 'POST', null, noUsername)).json()).pending, 0);
    assert.equal((await (await request('/profiles/me/photo-cleanup', 'POST', null, owner)).json()).pending, 1);
    m.failedDeletes.delete(paths[4]);
    assert.equal((await (await request('/profiles/me/photo-cleanup', 'POST', null, owner)).json()).pending, 0);
    assert.equal((await db.select().from(uploadReservationsTable).where(eq(uploadReservationsTable.objectPath, paths[4]))).length, 0);
    assert.equal((await (await request('/profiles/me/photo-cleanup', 'POST', null, owner)).json()).pending, 0);
    // Removing a shared object from one post must not delete the object or its metadata.
    const eventsBefore = m.storageEvents.filter(([action, p]) => action === 'delete' && p === paths[0]).length;
    assert.equal((await request(`/builds/${photo.id}`, 'PATCH', { removePhotoPaths:[paths[0]] }, owner)).status, 200);
    assert.equal(m.storageEvents.filter(([action, p]) => action === 'delete' && p === paths[0]).length, eventsBefore);
    assert.equal((await db.select().from(uploadReservationsTable).where(eq(uploadReservationsTable.objectPath, paths[0]))).length, 1);
    assert.equal((await request(`/storage${paths[0]}`)).status, 200);
    const last = await request(`/builds/${configPost.id}`, 'PATCH', { removePhotoPaths:[paths[0]] }, owner);
    assert.equal(last.status, 409);
    assert.equal((await (await request(`/builds/${configPost.id}`)).json()).photoPaths.length, 1);
    // Idempotent removal, persistence across independent requests and deleted saves.
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'DELETE', null, noUsername)).status, 204);
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'DELETE', null, noUsername)).status, 204);
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'PUT', null, noUsername)).status, 204);
    const [concurrentPost] = await db.insert(buildsTable).values({ userId:owner, title:'Concurrent removal fixture', photoPaths:paths.slice(0, 3) }).returning();
    const removals = await Promise.all([paths[1], paths[2]].map((p) =>
      request(`/builds/${concurrentPost.id}`, 'PATCH', { removePhotoPaths:[p] }, owner)));
    assert.ok(removals.every((r) => r.status === 200));
    assert.deepEqual((await (await request(`/builds/${concurrentPost.id}`)).json()).photoPaths, [paths[0]]);
    assert.equal((await request('/builds')).status, 200);
    assert.equal((await request(`/builds/${photo.id}`, 'DELETE', null, owner)).status, 204);
    assert.equal((await request(`/builds/${photo.id}`)).status, 404);
    assert.equal((await (await request('/profiles/me/favourites', 'GET', null, noUsername)).json()).items.length, 0);
    assert.equal((await request(`/builds/${photo.id}/favourite`, 'PUT', null, noUsername)).status, 404);
    await db.insert(favouritesTable).values(own.filter((b) => b.id !== photo.id).map((b) => ({ userId:noUsername, buildId:b.id })));
    const allSaved = [];
    cursor = undefined;
    do {
      const page = await (await request(`/profiles/me/favourites${cursor ? `?cursor=${cursor}` : ''}`, 'GET', null, noUsername)).json();
      assert.ok(page.items.every((b) => b.isFavourite && !b.isOwner));
      allSaved.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(allSaved.length, 46);
    assert.equal(new Set(allSaved.map((b) => b.id)).size, 46);
  } finally {
    await db.delete(favouritesTable).where(eq(favouritesTable.userId, noUsername));
    await db.delete(photoDeletionsTable).where(eq(photoDeletionsTable.userId, owner));
    await db.delete(profilesTable).where(eq(profilesTable.userId, owner));
    await db.delete(profilesTable).where(eq(profilesTable.userId, noUsername));
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await unlink(output);
  }
});
