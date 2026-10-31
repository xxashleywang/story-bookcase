import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const uploadReservationsTable = pgTable(
  "upload_reservations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("upload_reservations_object_path_unique").on(table.objectPath),
  ],
);

export const insertUploadReservationSchema = createInsertSchema(
  uploadReservationsTable,
).omit({
  id: true,
  isPublic: true,
  createdAt: true,
});
export type InsertUploadReservation = z.infer<
  typeof insertUploadReservationSchema
>;
export type UploadReservation = typeof uploadReservationsTable.$inferSelect;
