import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export interface BuildConfiguration {
  size: "standard" | "tall";
  color: string;
  shelfDirections: Array<"F" | "L" | "B" | "R">;
  wallColor: string;
  floorId: string;
  floorKind?: "Laminate" | "Carpet" | "Custom";
  customFloorColor?: string | null;
}

export const buildsTable = pgTable("builds", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  brand: text("brand"),
  modelName: text("model_name"),
  category: text("category").notNull().default("bookcase"),
  colorName: text("color_name").notNull(),
  colorHex: text("color_hex").notNull(),
  tags: text("tags").array().notNull().default([]),
  photoPaths: text("photo_paths").array().notNull(),
  configuration: jsonb("configuration").$type<BuildConfiguration>().notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBuildSchema = createInsertSchema(buildsTable).omit({
  id: true,
  likesCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Build = typeof buildsTable.$inferSelect;
