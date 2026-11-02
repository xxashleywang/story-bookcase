import { and, count, eq, sql } from "drizzle-orm";
import { db, buildsTable, photoDeletionsTable, uploadReservationsTable } from "@workspace/db";
import type { Request } from "express";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

const storage = new ObjectStorageService();

// Called while the shared photo-mutation lock is held. Never purge a shared object.
export async function retryPhotoDeletions(userId: string, req: Request) {
  const jobs = await db.select().from(photoDeletionsTable).where(eq(photoDeletionsTable.userId, userId));
  for (const job of jobs) {
    try {
      const [used] = await db.select({ count: count() }).from(buildsTable)
        .where(sql`${buildsTable.photoPaths} @> ARRAY[${job.objectPath}]::text[]`);
      if (!used?.count) {
        try {
          const file = await storage.getObjectEntityFile(job.objectPath);
          await storage.trySetObjectEntityAclPolicy(job.objectPath, { owner: userId, visibility: "private" });
          await file.delete({ ignoreNotFound: true });
        } catch (error) {
          if (!(error instanceof ObjectNotFoundError)) throw error;
        }
        await db.delete(uploadReservationsTable).where(eq(uploadReservationsTable.objectPath, job.objectPath));
      }
      await db.delete(photoDeletionsTable).where(and(eq(photoDeletionsTable.objectPath, job.objectPath), eq(photoDeletionsTable.userId, userId)));
    } catch (error) {
      req.log.error({ err: error, objectPath: job.objectPath }, "Photo deletion pending; owner can retry");
    }
  }
  return pendingPhotoDeletions(userId);
}

export async function pendingPhotoDeletions(userId: string) {
  const [row] = await db.select({ count: count() }).from(photoDeletionsTable).where(eq(photoDeletionsTable.userId, userId));
  return row?.count ?? 0;
}
