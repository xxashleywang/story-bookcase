import { pgTable, text, integer, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { buildsTable } from "./builds";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// No profile FK: saving inspiration does not require choosing a username.
export const favouritesTable = pgTable("favourites", {
  userId: text("user_id").notNull(),
  buildId: integer("build_id").notNull().references(() => buildsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.buildId] })]);
export const insertFavouriteSchema = createInsertSchema(favouritesTable).omit({ createdAt: true });
export type InsertFavourite = z.infer<typeof insertFavouriteSchema>;
export type Favourite = typeof favouritesTable.$inferSelect;

// Durable retry queue; survives post deletion and storage outages.
export const photoDeletionsTable = pgTable("photo_deletions", {
  objectPath: text("object_path").primaryKey(),
  userId: text("user_id").notNull(),
});
