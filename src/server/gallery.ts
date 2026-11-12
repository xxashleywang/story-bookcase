import { randomUUID } from "node:crypto";
import { sql, table, transaction, type Query } from "../lib/db";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const USERNAME = /^[A-Za-z0-9._-]{3,24}$/;
const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const MAX_BYTES = 12_000_000;
const MAX_PHOTOS = 4;
const MAX_STORED = 40;

type PhotoType = (typeof PHOTO_TYPES)[number];

export type Viewer = { id: string; name: string; kind: "person" | "key" };

type BuildRow = {
  id: number | string;
  user_id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model_name: string | null;
  category: string;
  color_name: string | null;
  color_hex: string | null;
  tags: unknown;
  photo_paths: unknown;
  configuration: unknown;
  likes_count: number | string | null;
  created_at: string | Date;
  creator_username?: string | null;
};

function fail(status: number, error: string) {
  return { status, error } as const;
}

function pgCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) return String((error as { code: unknown }).code);
  return "";
}

function iso(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function present(row: BuildRow, viewerId: string, favouriteIds: Set<number>) {
  let configuration = row.configuration;
  if (typeof configuration === "string") {
    try { configuration = JSON.parse(configuration); } catch { configuration = null; }
  }
  const id = Number(row.id);
  return {
    id,
    title: row.title,
    description: row.description,
    brand: row.brand,
    modelName: row.model_name,
    category: row.category,
    colorName: row.color_name,
    colorHex: row.color_hex,
    tags: textList(row.tags),
    photoPaths: textList(row.photo_paths),
    configuration: configuration ?? null,
    creatorUsername: row.creator_username || "maker",
    createdAt: iso(row.created_at),
    likesCount: Number(row.likes_count ?? 0),
    isOwner: row.user_id === viewerId,
    isFavourite: favouriteIds.has(id),
  };
}

async function favouriteIds(query: Query, viewerId: string, ids: number[]) {
  if (!ids.length) return new Set<number>();
  const rows = await query<{ build_id: number | string }>(
    `select build_id from ${table("favourites")} where user_id = $1 and build_id = any($2::int[])`,
    [viewerId, ids],
  );
  return new Set(rows.map((row) => Number(row.build_id)));
}

async function decorate(query: Query, rows: BuildRow[], viewerId: string) {
  const saved = await favouriteIds(query, viewerId, rows.map((row) => Number(row.id)));
  return rows.map((row) => present(row, viewerId, saved));
}

async function profileUsername(query: Query, userId: string) {
  const rows = await query<{ username: string | null }>(
    `select username from ${table("profiles")} where user_id = $1 limit 1`,
    [userId],
  );
  return rows[0]?.username ?? null;
}

function photoPath(id: string) {
  return `/objects/uploads/${id}`;
}

function photoId(path: string) {
  const match = /^\/objects\/uploads\/([0-9a-f-]{36})$/i.exec(path);
  return match && PHOTO_ID.test(match[1]) ? match[1] : null;
}

function looksLike(bytes: Uint8Array, type: PhotoType) {
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp") {
    return bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  const brand = new TextDecoder().decode(bytes.subarray(4, 12));
  return bytes.length > 12 && brand.startsWith("ftyp") && (brand.includes("avif") || brand.includes("avis"));
}

function parseConfig(value: unknown) {
  if (value === undefined) return { ok: true as const, value: undefined };
  if (value === null) return { ok: true as const, value: null };
  if (!value || typeof value !== "object") return { ok: false as const };
  const config = value as Record<string, unknown>;
  const dirs = config.shelfDirections;
  const floorKind = config.floorKind;
  if (config.size !== "standard" && config.size !== "tall") return { ok: false as const };
  if (typeof config.color !== "string" || !HEX.test(config.color)) return { ok: false as const };
  if (typeof config.wallColor !== "string" || !HEX.test(config.wallColor)) return { ok: false as const };
  if (typeof config.floorId !== "string" || config.floorId.length < 1 || config.floorId.length > 40) return { ok: false as const };
  if (!Array.isArray(dirs) || dirs.length < 1 || dirs.length > 12 || dirs.some((dir) => dir !== "F" && dir !== "L" && dir !== "B" && dir !== "R")) {
    return { ok: false as const };
  }
  if (floorKind !== undefined && floorKind !== "Laminate" && floorKind !== "Carpet" && floorKind !== "Custom") return { ok: false as const };
  if (config.customFloorColor != null && (typeof config.customFloorColor !== "string" || !HEX.test(config.customFloorColor))) {
    return { ok: false as const };
  }
  return { ok: true as const, value: config };
}

function cleanText(value: unknown, max: number) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

async function purgeStale(query: Query, userId: string) {
  await query(
    `delete from ${table("photos")} where user_id = $1 and attached = false and created_at < now() - interval '1 day'`,
    [userId],
  );
}

export async function getSession(viewer: Viewer) {
  const name = viewer.name.trim() || "Account";
  return { id: viewer.id, name, firstName: name.split(/\s+/)[0] || name };
}

export async function getProfile(viewer: Viewer) {
  const rows = await sql<{ username: string | null; display_name: string | null }>(
    `select username, display_name from ${table("profiles")} where user_id = $1 limit 1`,
    [viewer.id],
  );
  const profile = rows[0];
  return {
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
    isUsernameSet: Boolean(profile?.username),
  };
}

export async function usernameAvailable(username: string) {
  if (!USERNAME.test(username) || !/[A-Za-z0-9]/.test(username)) return fail(400, "Use 3–24 letters, numbers, periods, underscores, or hyphens.");
  const rows = await sql<{ user_id: string }>(
    `select user_id from ${table("profiles")} where username_key = $1 limit 1`,
    [username.toLowerCase()],
  );
  return { username, available: rows.length === 0 };
}

export async function saveUsername(viewer: Viewer, username: string) {
  if (!USERNAME.test(username) || !/[A-Za-z0-9]/.test(username)) {
    return fail(400, "Usernames must be 3–24 characters and include at least one letter or number.");
  }
  const key = username.toLowerCase();
  const taken = await sql<{ user_id: string }>(
    `select user_id from ${table("profiles")} where username_key = $1 limit 1`,
    [key],
  );
  if (taken[0] && taken[0].user_id !== viewer.id) return fail(400, "That username is already taken.");
  try {
    const rows = await sql<{ username: string | null; display_name: string | null }>(
      `insert into ${table("profiles")} (user_id, username, username_key, display_name)
       values ($1, $2, $3, $2)
       on conflict (user_id) do update set username = excluded.username, username_key = excluded.username_key, display_name = excluded.username, updated_at = now()
       returning username, display_name`,
      [viewer.id, username, key],
    );
    return { username: rows[0].username, displayName: rows[0].display_name, isUsernameSet: true };
  } catch (error) {
    if (pgCode(error) === "23505") return fail(400, "That username is already taken.");
    console.error("gallery username failed", pgCode(error));
    return fail(500, "Could not save your username. Try again.");
  }
}

export async function communitySummary() {
  const builds = await sql<{ count: string | number }>(`select count(*)::int as count from ${table("builds")}`);
  const builders = await sql<{ count: string | number }>(
    `select count(*)::int as count from ${table("profiles")} where username is not null`,
  );
  const tags = await sql<{ tags: unknown }>(`select tags from ${table("builds")}`);
  const counts = new Map<string, number>();
  for (const row of tags) {
    for (const tag of textList(row.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const popularTags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([tag]) => tag);
  return {
    totalBuilds: Number(builds[0]?.count ?? 0),
    totalBuilders: Number(builders[0]?.count ?? 0),
    popularTags,
  };
}

export async function listBuilds(viewer: Viewer, search: URLSearchParams) {
  const sort = search.get("sort") === "popular" ? "popular" : "recent";
  const requested = Number(search.get("limit") ?? 24);
  const limit = Number.isInteger(requested) ? Math.min(40, Math.max(1, requested)) : 24;
  const where: string[] = [];
  const params: unknown[] = [];
  const hold = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const q = search.get("q")?.trim();
  if (q) {
    const pattern = likePattern(q);
    const a = hold(pattern);
    const b = hold(pattern);
    const c = hold(pattern);
    const d = hold(pattern);
    where.push(`(b.title ilike ${a} escape '\\' or b.description ilike ${b} escape '\\' or b.brand ilike ${c} escape '\\' or b.model_name ilike ${d} escape '\\')`);
  }
  const brand = search.get("brand")?.trim();
  if (brand) where.push(`b.brand ilike ${hold(likePattern(brand))} escape '\\'`);
  const color = search.get("color")?.trim();
  if (color) {
    const pattern = likePattern(color);
    where.push(`(b.color_name ilike ${hold(pattern)} escape '\\' or b.color_hex ilike ${hold(pattern)} escape '\\')`);
  }
  const tag = search.get("tag")?.trim();
  if (tag) where.push(`b.tags @> array[${hold(tag)}]::text[]`);
  params.push(limit);
  const rows = await sql<BuildRow>(
    `select b.*, p.username as creator_username
     from ${table("builds")} b
     inner join ${table("profiles")} p on p.user_id = b.user_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by ${sort === "popular" ? "b.likes_count desc, b.created_at desc" : "b.created_at desc"}
     limit $${params.length}`,
    params,
  );
  return decorate(sql, rows, viewer.id);
}

export async function getBuild(viewer: Viewer, id: number) {
  const rows = await sql<BuildRow>(
    `select b.*, p.username as creator_username
     from ${table("builds")} b
     inner join ${table("profiles")} p on p.user_id = b.user_id
     where b.id = $1 limit 1`,
    [id],
  );
  if (!rows[0]) return fail(404, "Build not found.");
  return (await decorate(sql, [rows[0]], viewer.id))[0];
}

async function claimPhotos(query: Query, userId: string, paths: string[]) {
  const ids = paths.map(photoId);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return false;
  const rows = await query<{ id: string }>(
    `update ${table("photos")} set attached = true
     where user_id = $1 and id = any($2::text[]) and attached = false and bytes is not null
     returning id`,
    [userId, ids],
  );
  return rows.length === ids.length;
}

export async function createBuild(viewer: Viewer, body: Record<string, unknown>) {
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 1200);
  const paths = body.photoPaths;
  const config = parseConfig(body.configuration);
  if (typeof title !== "string" || title.length < 2 || description === undefined || !Array.isArray(paths) || paths.length < 1 || paths.length > MAX_PHOTOS || !config.ok) {
    return fail(400, "Check the build details and photos.");
  }
  if (paths.some((path) => typeof path !== "string")) return fail(400, "Check the build details and photos.");
  const username = await profileUsername(sql, viewer.id);
  if (!username) return fail(400, "Choose a username before publishing.");
  try {
    const build = await transaction(async (query) => {
      if (!(await claimPhotos(query, viewer.id, paths as string[]))) return null;
      const rows = await query<BuildRow>(
        `insert into ${table("builds")} (user_id, title, description, category, tags, photo_paths, configuration)
         values ($1, $2, $3, 'bookcase', '{}', $4::text[], $5::jsonb)
         returning *`,
        [viewer.id, title, description, paths, config.value === undefined ? null : JSON.stringify(config.value)],
      );
      return rows[0];
    });
    if (!build) return fail(400, "One or more photos are missing or were not uploaded by you.");
    return present({ ...build, creator_username: username }, viewer.id, new Set());
  } catch (error) {
    console.error("gallery create failed", pgCode(error));
    return fail(500, "The photos uploaded, but the build could not be saved. Please try again.");
  }
}

async function queueDeletion(query: Query, userId: string, paths: string[]) {
  for (const objectPath of paths) {
    await query(
      `insert into ${table("photo_deletions")} (object_path, user_id) values ($1, $2) on conflict (object_path) do nothing`,
      [objectPath, userId],
    );
  }
}

export async function retryPhotoCleanup(viewer: Viewer) {
  const queued = await sql<{ object_path: string }>(
    `select object_path from ${table("photo_deletions")} where user_id = $1`,
    [viewer.id],
  );
  for (const row of queued) {
    const stillUsed = await sql<{ count: string | number }>(
      `select count(*)::int as count from ${table("builds")} where photo_paths @> array[$1]::text[]`,
      [row.object_path],
    );
    if (Number(stillUsed[0]?.count ?? 0) > 0) continue;
    const id = photoId(row.object_path);
    if (id) {
      await sql(`delete from ${table("photos")} where id = $1 and user_id = $2`, [id, viewer.id]);
    }
    await sql(`delete from ${table("photo_deletions")} where object_path = $1 and user_id = $2`, [row.object_path, viewer.id]);
  }
  const pending = await sql<{ count: string | number }>(
    `select count(*)::int as count from ${table("photo_deletions")} where user_id = $1`,
    [viewer.id],
  );
  return { pending: Number(pending[0]?.count ?? 0) };
}

export async function updateBuild(viewer: Viewer, id: number, body: Record<string, unknown>) {
  const currentRows = await sql<BuildRow>(
    `select * from ${table("builds")} where id = $1 and user_id = $2 limit 1`,
    [id, viewer.id],
  );
  const current = currentRows[0];
  if (!current) return fail(404, "Build not found.");
  if (!Object.keys(body).length) return fail(400, "Invalid build update.");
  const title = body.title === undefined ? undefined : cleanText(body.title, 80);
  const description = body.description === undefined ? undefined : cleanText(body.description, 1200);
  const config = body.configuration === undefined ? undefined : parseConfig(body.configuration);
  if (title === undefined && body.title !== undefined) return fail(400, "Invalid build update.");
  if (typeof title === "string" && title.length < 2) return fail(400, "Invalid build update.");
  if (description === undefined && body.description !== undefined) return fail(400, "Invalid build update.");
  if (config && !config.ok) return fail(400, "Invalid build update.");
  const remove = body.removePhotoPaths;
  const replacement = body.photoPaths;
  if (remove !== undefined && (!Array.isArray(remove) || remove.some((path) => typeof path !== "string") || replacement)) {
    return fail(400, "Remove only existing photos, without replacing the photo set.");
  }
  const currentPaths = textList(current.photo_paths);
  if (Array.isArray(remove) && remove.some((path) => !currentPaths.includes(path))) {
    return fail(400, "Remove only existing photos, without replacing the photo set.");
  }
  const nextPaths = Array.isArray(remove)
    ? currentPaths.filter((path) => !(remove as string[]).includes(path))
    : Array.isArray(replacement) ? replacement as string[] : currentPaths;
  if (!nextPaths.length) return fail(409, "This is the last photo. Delete the whole post instead.");
  if (Array.isArray(replacement) && (replacement.length < 1 || replacement.length > MAX_PHOTOS)) return fail(400, "Invalid build update.");
  try {
    const updated = await transaction(async (query) => {
      if (Array.isArray(replacement) && !(await claimPhotos(query, viewer.id, replacement as string[]))) return "photos" as const;
      const sets = ["updated_at = now()"];
      const params: unknown[] = [];
      const set = (column: string, value: unknown, cast = "") => {
        params.push(value);
        sets.push(`${column} = $${params.length}${cast}`);
      };
      if (typeof title === "string") set("title", title);
      if (description !== undefined) set("description", description);
      if (config) set("configuration", config.value === null ? null : JSON.stringify(config.value), "::jsonb");
      if (Array.isArray(remove) || Array.isArray(replacement)) set("photo_paths", nextPaths, "::text[]");
      params.push(id, viewer.id);
      const rows = await query<BuildRow>(
        `update ${table("builds")} set ${sets.join(", ")} where id = $${params.length - 1} and user_id = $${params.length} returning *`,
        params,
      );
      const removed = currentPaths.filter((path) => !nextPaths.includes(path));
      if (removed.length) await queueDeletion(query, viewer.id, removed);
      return rows[0];
    });
    if (updated === "photos") return fail(400, "One or more photos are missing or were not uploaded by you.");
    if (!updated) return fail(404, "Build not found.");
    const username = await profileUsername(sql, viewer.id);
    if (currentPaths.some((path) => !nextPaths.includes(path))) await retryPhotoCleanup(viewer);
    const saved = await favouriteIds(sql, viewer.id, [id]);
    return present({ ...updated, creator_username: username }, viewer.id, saved);
  } catch (error) {
    console.error("gallery update failed", pgCode(error));
    return fail(500, "The photos uploaded, but the build could not be updated.");
  }
}

export async function deleteBuild(viewer: Viewer, id: number) {
  const deleted = await transaction(async (query) => {
    const rows = await query<BuildRow>(
      `delete from ${table("builds")} where id = $1 and user_id = $2 returning photo_paths`,
      [id, viewer.id],
    );
    if (!rows[0]) return null;
    const paths = textList(rows[0].photo_paths);
    if (paths.length) await queueDeletion(query, viewer.id, paths);
    return rows[0];
  });
  if (!deleted) return fail(404, "Build not found.");
  await retryPhotoCleanup(viewer);
  return { ok: true as const };
}

async function myPage(viewer: Viewer, kind: "uploads" | "favourites", cursor: number | null) {
  const params: unknown[] = [viewer.id];
  let cursorClause = "";
  if (cursor) {
    params.push(cursor);
    cursorClause = ` and b.id < $${params.length}`;
  }
  const where = kind === "uploads"
    ? `b.user_id = $1${cursorClause}`
    : `exists (select 1 from ${table("favourites")} f where f.build_id = b.id and f.user_id = $1)${cursorClause}`;
  const rows = await sql<BuildRow>(
    `select b.*, p.username as creator_username
     from ${table("builds")} b
     left join ${table("profiles")} p on p.user_id = b.user_id
     where ${where}
     order by b.id desc
     limit 25`,
    params,
  );
  const page = rows.slice(0, 24);
  const pending = await sql<{ count: string | number }>(
    `select count(*)::int as count from ${table("photo_deletions")} where user_id = $1`,
    [viewer.id],
  );
  return {
    items: await decorate(sql, page, viewer.id),
    nextCursor: rows.length > 24 ? Number(rows[23].id) : null,
    cleanupPending: Number(pending[0]?.count ?? 0),
  };
}

export function listMyBuilds(viewer: Viewer, cursor: number | null) {
  return myPage(viewer, "uploads", cursor);
}

export function listMyFavourites(viewer: Viewer, cursor: number | null) {
  return myPage(viewer, "favourites", cursor);
}

export async function saveFavourite(viewer: Viewer, id: number) {
  const rows = await sql<{ exists: string | number }>(
    `with ins as (
       insert into ${table("favourites")} (user_id, build_id)
       select $1, id from ${table("builds")} where id = $2
       on conflict do nothing
       returning build_id
     )
     select (select count(*)::int from ${table("builds")} where id = $2) as exists`,
    [viewer.id, id],
  );
  if (!Number(rows[0]?.exists ?? 0)) return fail(404, "Room not found.");
  return { ok: true as const };
}

export async function removeFavourite(viewer: Viewer, id: number) {
  await sql(
    `delete from ${table("favourites")} where user_id = $1 and build_id = $2`,
    [viewer.id, id],
  );
  return { ok: true as const };
}

export async function requestUpload(viewer: Viewer, body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const size = body.size;
  const contentType = body.contentType;
  if (!name || name.length > 180 || typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) {
    return fail(400, "Missing or invalid required fields");
  }
  if (!PHOTO_TYPES.includes(contentType as PhotoType)) return fail(400, "Missing or invalid required fields");
  const username = await profileUsername(sql, viewer.id);
  if (!username) return fail(400, "Choose a username before uploading photos.");
  await purgeStale(sql, viewer.id);
  const count = await sql<{ count: string | number }>(
    `select count(*)::int as count from ${table("photos")} where user_id = $1`,
    [viewer.id],
  );
  if (Number(count[0]?.count ?? 0) >= MAX_STORED) return fail(400, "Photo storage for this account is full.");
  const id = randomUUID();
  await sql(
    `insert into ${table("photos")} (id, user_id, content_type, size) values ($1, $2, $3, $4)`,
    [id, viewer.id, contentType, size],
  );
  const objectPath = photoPath(id);
  return {
    uploadURL: `/api/storage/uploads/raw/${id}`,
    objectPath,
    metadata: { name, size, contentType },
  };
}

export async function storeUpload(viewer: Viewer, id: string, type: string, bytes: Uint8Array) {
  if (!PHOTO_ID.test(id)) return fail(404, "Object not found");
  const rows = await sql<{ content_type: string; size: number | string; bytes: Uint8Array | null }>(
    `select content_type, size, bytes from ${table("photos")} where id = $1 and user_id = $2 limit 1`,
    [id, viewer.id],
  );
  const photo = rows[0];
  if (!photo) return fail(404, "Object not found");
  if (photo.bytes) return fail(409, "That photo was already uploaded.");
  if (type !== photo.content_type || bytes.byteLength !== Number(photo.size)) return fail(400, "The uploaded file does not match the photo you reserved.");
  if (!looksLike(bytes, photo.content_type as PhotoType)) return fail(400, "That file is not a valid image of the type you selected.");
  const saved = await sql<{ id: string }>(
    `update ${table("photos")} set bytes = $1 where id = $2 and user_id = $3 and bytes is null returning id`,
    [bytes, id, viewer.id],
  );
  if (!saved[0]) return fail(409, "That photo was already uploaded.");
  return { ok: true as const };
}

export async function readPhoto(viewer: Viewer, id: string) {
  if (!PHOTO_ID.test(id)) return fail(404, "Object not found");
  const rows = await sql<{ user_id: string; content_type: string; bytes: Uint8Array | Buffer | null; attached: boolean }>(
    `select user_id, content_type, bytes, attached from ${table("photos")} where id = $1 limit 1`,
    [id],
  );
  const photo = rows[0];
  if (!photo?.bytes) return fail(404, "Object not found");
  const path = photoPath(id);
  const used = await sql<{ count: string | number }>(
    `select count(*)::int as count from ${table("builds")} where photo_paths @> array[$1]::text[]`,
    [path],
  );
  const shared = Number(used[0]?.count ?? 0) > 0;
  if (!shared && photo.user_id !== viewer.id) return fail(404, "Photo is no longer shared");
  const raw = photo.bytes;
  const body = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return { contentType: photo.content_type, body };
}
