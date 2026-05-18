import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  goalSheetId: integer("goal_sheet_id").notNull(),
  thrustAreaId: integer("thrust_area_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  uomType: text("uom_type", { enum: ["numeric_min", "numeric_max", "timeline", "zero"] }).notNull(),
  uomUnit: text("uom_unit"),
  target: text("target").notNull(),
  weightage: doublePrecision("weightage").notNull(),
  status: text("status", { enum: ["not_started", "on_track", "completed"] }).notNull().default("not_started"),
  isShared: boolean("is_shared").notNull().default(false),
  sharedGoalId: integer("shared_goal_id"),
  isReadOnly: boolean("is_read_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
