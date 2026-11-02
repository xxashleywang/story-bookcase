import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import {
  CreateBuildBody,
  CreateBuildResponse,
  DeleteBuildParams,
  GetBuildParams,
  GetBuildResponse,
  GetCommunitySummaryResponse,
  ListBuildsQueryParams,
  ListBuildsResponse,
  UpdateBuildBody,
  UpdateBuildParams,
  UpdateBuildResponse,
  ListMyBuildsQueryParams,
  ListMyFavouritesQueryParams,
  ListMyBuildsResponse,
} from "@workspace/api-zod";
import {
  buildsTable,
  db,
  profilesTable,
  uploadReservationsTable,
  favouritesTable,
  photoDeletionsTable,
  withAdvisoryLock,
} from "@workspace/db";
import { getCurrentUserId } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { validStoredPhoto } from "../lib/photoValidation";
import { pendingPhotoDeletions, retryPhotoDeletions } from "../lib/photoCleanup";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

// Serialize publish/removal/cleanup across server instances, not just this process.
// A dedicated session holds the lock while ordinary pooled DB operations run.
function photoMutation(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
  if (!getCurrentUserId(req)) { await handler(req, res, next); return; }
  await withAdvisoryLock(82140731, async () => { await handler(req, res, next); });
  };
}

async function decorate(rows: Array<{ build: typeof buildsTable.$inferSelect; creatorUsername: string | null }>, userId: string | null) {
  const saved = userId && rows.length ? await db.select({ id: favouritesTable.buildId }).from(favouritesTable)
    .where(and(eq(favouritesTable.userId, userId), inArray(favouritesTable.buildId, rows.map((r) => r.build.id)))) : [];
  const ids = new Set(saved.map((r) => r.id));
  return rows.map(({ build, creatorUsername }) => ({ ...build, creatorUsername: creatorUsername ?? "maker", isOwner: build.userId === userId, isFavourite: ids.has(build.id) }));
}

for (const collection of ["builds", "favourites"] as const) {
  router.get(`/profiles/me/${collection}`, async (req, res): Promise<void> => {
    const userId = getCurrentUserId(req);
    res.setHeader("Cache-Control", "private, no-store");
    if (!userId) { res.status(401).json({ error: "Sign in to view your collection." }); return; }
    const parsed = (collection === "builds" ? ListMyBuildsQueryParams : ListMyFavouritesQueryParams).safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: "Invalid page cursor." }); return; }
    const conditions = [collection === "builds" ? eq(buildsTable.userId, userId) :
      sql`exists (select 1 from ${favouritesTable} where ${favouritesTable.buildId} = ${buildsTable.id} and ${favouritesTable.userId} = ${userId})`];
    if (parsed.data.cursor) conditions.push(lt(buildsTable.id, parsed.data.cursor));
    const rows = await db.select({ build: buildsTable, creatorUsername: profilesTable.username }).from(buildsTable)
      .leftJoin(profilesTable, eq(buildsTable.userId, profilesTable.userId)).where(and(...conditions)).orderBy(desc(buildsTable.id)).limit(25);
    res.json(ListMyBuildsResponse.parse({ items: await decorate(rows.slice(0, 24), userId),
      nextCursor: rows.length > 24 ? rows[23].build.id : null, cleanupPending: await pendingPhotoDeletions(userId) }));
  });
}

router.post("/profiles/me/photo-cleanup", photoMutation(async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Sign in to retry photo deletion." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ pending: await retryPhotoDeletions(userId, req) });
}));

router.put("/builds/:id/favourite", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Sign in to save inspiration." }); return; }
  const parsed = GetBuildParams.safeParse({ id: routeId(req.params.id) });
  if (!parsed.success || parsed.data.id < 1) { res.status(400).json({ error: "Invalid post." }); return; }
  // The unique key handles duplicate saves; the FK handles concurrent removal.
  try {
    const result = await db.insert(favouritesTable).values({ userId, buildId: parsed.data.id }).onConflictDoNothing();
    void result;
    res.sendStatus(204);
  } catch (error) {
    if ((error as { cause?: { code?: string }; code?: string }).cause?.code === "23503" || (error as { code?: string }).code === "23503") {
      res.status(404).json({ error: "Room not found." }); return;
    }
    throw error;
  }
});
router.delete("/builds/:id/favourite", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Sign in to change saved inspiration." }); return; }
  const parsed = GetBuildParams.safeParse({ id: routeId(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid post." }); return; }
  await db.delete(favouritesTable).where(and(eq(favouritesTable.userId, userId), eq(favouritesTable.buildId, parsed.data.id)));
  res.sendStatus(204);
});

async function makePhotosPublic(
  userId: string,
  photoPaths: string[],
  req: Request,
): Promise<boolean> {
  const uniquePaths = [...new Set(photoPaths)];
  if (uniquePaths.length !== photoPaths.length || photoPaths.length === 0 || photoPaths.length > 4) {
    return false;
  }

  const recentEnough = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reservations = await db
    .select({
      objectPath: uploadReservationsTable.objectPath,
      size: uploadReservationsTable.size,
      contentType: uploadReservationsTable.contentType,
    })
    .from(uploadReservationsTable)
    .where(
      and(
        eq(uploadReservationsTable.userId, userId),
        inArray(uploadReservationsTable.objectPath, uniquePaths),
        gt(uploadReservationsTable.createdAt, recentEnough),
      ),
    );
  if (reservations.length !== uniquePaths.length) return false;

  for (const objectPath of uniquePaths) {
    if (!objectPath.startsWith("/objects/uploads/")) {
      return false;
    }
    try {
      const file = await objectStorage.getObjectEntityFile(objectPath);
      const [metadata] = await file.getMetadata();
      const reservation = reservations.find((item) => item.objectPath === objectPath)!;
      if (!validStoredPhoto(reservation, metadata)) return false;
    } catch {
      return false;
    }
  }

  const publicPaths: string[] = [];
  try {
    for (const objectPath of uniquePaths) {
      await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "public",
      });
      publicPaths.push(objectPath);
    }

    await db
      .update(uploadReservationsTable)
      .set({ isPublic: true })
      .where(
        and(
          eq(uploadReservationsTable.userId, userId),
          inArray(uploadReservationsTable.objectPath, uniquePaths),
        ),
      );
    return true;
  } catch (error) {
    req.log.error({ err: error, objectPaths: publicPaths }, "Could not publish build photos");
    await makeUnusedPhotosPrivate(userId, publicPaths, req);
    return false;
  }
}

async function makeUnusedPhotosPrivate(
  userId: string,
  photoPaths: string[],
  req: Request,
): Promise<void> {
  for (const objectPath of new Set(photoPaths)) {
    const [stillUsed] = await db
      .select({ count: count() })
      .from(buildsTable)
      .where(sql`${buildsTable.photoPaths} @> ARRAY[${objectPath}]::text[]`);
    if ((stillUsed?.count ?? 0) > 0) continue;

    try {
      await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "private",
      });
    } catch (error) {
      // A failed privacy update is important to investigate, but should not
      // turn a successful post edit/delete into a misleading failure response.
      req.log.error(
        { err: error, objectPath },
        "Failed to update photo visibility after build removal",
      );
    }
    await db
      .update(uploadReservationsTable)
      .set({ isPublic: false })
      .where(
        and(
          eq(uploadReservationsTable.objectPath, objectPath),
          eq(uploadReservationsTable.userId, userId),
        ),
      );
  }
}

function routeId(raw: string | string[] | undefined): string {
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

router.get("/builds", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = ListBuildsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid gallery filters." });
    return;
  }

  const { q, brand, color, tag, sort, limit } = parsed.data;
  const conditions: SQL[] = [];
  if (q?.trim()) {
    const pattern = `%${q.trim()}%`;
    const searchCondition = or(
      ilike(buildsTable.title, pattern),
      ilike(buildsTable.description, pattern),
      ilike(buildsTable.brand, pattern),
      ilike(buildsTable.modelName, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (brand?.trim()) conditions.push(ilike(buildsTable.brand, brand.trim()));
  if (color?.trim()) {
    const colorCondition = or(
      ilike(buildsTable.colorName, color.trim()),
      ilike(buildsTable.colorHex, color.trim()),
    );
    if (colorCondition) conditions.push(colorCondition);
  }
  if (tag?.trim()) {
    conditions.push(
      sql`${buildsTable.tags} @> ARRAY[${tag.trim()}]::text[]`,
    );
  }

  const query = db
    .select({
      build: buildsTable,
      creatorUsername: profilesTable.username,
    })
    .from(buildsTable)
    .innerJoin(profilesTable, eq(buildsTable.userId, profilesTable.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      ...(sort === "popular"
        ? [desc(buildsTable.likesCount), desc(buildsTable.createdAt)]
        : [desc(buildsTable.createdAt)]),
    )
    .limit(limit ?? 24);

  const rows = await query;
  res.json(
    ListBuildsResponse.parse(
      await decorate(rows, getCurrentUserId(req)),
    ),
  );
});

router.get("/builds/:id", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = GetBuildParams.safeParse({ id: routeId(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid build id." });
    return;
  }

  const [row] = await db
    .select({
      build: buildsTable,
      creatorUsername: profilesTable.username,
    })
    .from(buildsTable)
    .innerJoin(profilesTable, eq(buildsTable.userId, profilesTable.userId))
    .where(eq(buildsTable.id, parsed.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Build not found." });
    return;
  }

  res.json(
    GetBuildResponse.parse((await decorate([row], getCurrentUserId(req)))[0]),
  );
});

router.post("/builds", photoMutation(async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to publish a build." });
    return;
  }

  const parsed = CreateBuildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the build details and photos." });
    return;
  }

  const [profile] = await db
    .select({ username: profilesTable.username })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  if (!profile?.username) {
    res.status(400).json({ error: "Choose a username before publishing." });
    return;
  }

  if (!(await makePhotosPublic(userId, parsed.data.photoPaths, req))) {
    res.status(400).json({
      error: "One or more photos are missing or were not uploaded by you.",
    });
    return;
  }

  let build: typeof buildsTable.$inferSelect | undefined;
  try {
    [build] = await db
      .insert(buildsTable)
      .values({ ...parsed.data, userId })
      .returning();
  } catch (error) {
    req.log.error({ err: error }, "Could not save community build");
    await makeUnusedPhotosPrivate(userId, parsed.data.photoPaths, req);
    res.status(500).json({ error: "The photos uploaded, but the build could not be saved. Please try again." });
    return;
  }

  res.status(201).json(
    CreateBuildResponse.parse({
      ...build,
      creatorUsername: profile.username,
    }),
  );
}));

router.patch("/builds/:id", photoMutation(async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to edit a build." });
    return;
  }

  const params = UpdateBuildParams.safeParse({ id: routeId(req.params.id) });
  const body = UpdateBuildBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data ?? {}).length === 0) {
    res.status(400).json({ error: "Invalid build update." });
    return;
  }

  const [current] = await db
    .select()
    .from(buildsTable)
    .where(
      and(
        eq(buildsTable.id, params.data.id),
        eq(buildsTable.userId, userId),
      ),
    )
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Build not found." });
    return;
  }

  const { removePhotoPaths, ...changes } = body.data;
  if (removePhotoPaths && (changes.photoPaths || removePhotoPaths.some((p) => !current.photoPaths.includes(p)))) {
    res.status(400).json({ error: "Remove only existing photos, without replacing the photo set." }); return;
  }
  const nextPhotoPaths = removePhotoPaths ? current.photoPaths.filter((p) => !removePhotoPaths.includes(p)) : changes.photoPaths ?? current.photoPaths;
  if (!nextPhotoPaths.length) { res.status(409).json({ error: "This is the last photo. Delete the whole post instead." }); return; }
  if (removePhotoPaths) changes.photoPaths = nextPhotoPaths;
  if (
    body.data.photoPaths &&
    !(await makePhotosPublic(userId, body.data.photoPaths, req))
  ) {
    res.status(400).json({
      error: "One or more photos are missing or were not uploaded by you.",
    });
    return;
  }

  let updated: typeof buildsTable.$inferSelect | undefined;
  try {
    updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(buildsTable).set(changes)
        .where(and(eq(buildsTable.id, params.data.id), eq(buildsTable.userId, userId))).returning();
      const removed = current.photoPaths.filter((p) => !nextPhotoPaths.includes(p));
      if (removed.length) await tx.insert(photoDeletionsTable).values(removed.map((objectPath) => ({ objectPath, userId }))).onConflictDoNothing();
      return row;
    });
  } catch (error) {
    req.log.error({ err: error }, "Could not update community build");
    if (body.data.photoPaths) {
      await makeUnusedPhotosPrivate(userId, body.data.photoPaths, req);
    }
    res.status(500).json({ error: "The photos uploaded, but the build could not be updated." });
    return;
  }
  if (!updated) {
    res.status(404).json({ error: "Build not found." });
    return;
  }

  const [profile] = await db
    .select({ username: profilesTable.username })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  const removedPhotos = current.photoPaths.filter(
    (path) => !nextPhotoPaths.includes(path),
  );
  if (removedPhotos.length) await retryPhotoDeletions(userId, req);

  res.json(
    UpdateBuildResponse.parse({
      ...updated,
      creatorUsername: profile?.username ?? "maker",
      isOwner: true,
      isFavourite: (await decorate([{ build: updated, creatorUsername: profile?.username ?? null }], userId))[0].isFavourite,
    }),
  );
}));

router.delete("/builds/:id", photoMutation(async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to delete a build." });
    return;
  }

  const parsed = DeleteBuildParams.safeParse({ id: routeId(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid build id." });
    return;
  }

  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx.delete(buildsTable)
    .where(
      and(
        eq(buildsTable.id, parsed.data.id),
        eq(buildsTable.userId, userId),
      ),
    )
    .returning();
    if (row?.photoPaths.length) await tx.insert(photoDeletionsTable).values(row.photoPaths.map((objectPath) => ({ objectPath, userId }))).onConflictDoNothing();
    return row;
  });
  if (!deleted) {
    res.status(404).json({ error: "Build not found." });
    return;
  }

  await retryPhotoDeletions(userId, req);
  res.sendStatus(204);
}));

router.get("/community/summary", async (_req, res): Promise<void> => {
  const [buildCount] = await db
    .select({ count: count() })
    .from(buildsTable);
  const [builderCount] = await db
    .select({ count: count() })
    .from(profilesTable)
    .where(isNotNull(profilesTable.username));
  const buildTags = await db.select({ tags: buildsTable.tags }).from(buildsTable);
  const tagCounts = new Map<string, number>();
  for (const row of buildTags) {
    for (const tag of row.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const popularTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag]) => tag);

  res.json(
    GetCommunitySummaryResponse.parse({
      totalBuilds: buildCount?.count ?? 0,
      totalBuilders: builderCount?.count ?? 0,
      popularTags,
    }),
  );
});

export default router;
