import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalUpdatesTable = pgTable("goal_updates", {
  id: serial("id").primaryKey(),
  checkInId: integer("check_in_id").notNull(),
  goalId: integer("goal_id").notNull(),
  achievement: text("achievement").notNull(),
  status: text("status", { enum: ["not_started", "on_track", "completed"] }).notNull().default("not_started"),
  notes: text("notes"),
  progressScore: doublePrecision("progress_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGoalUpdateSchema = createInsertSchema(goalUpdatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoalUpdate = z.infer<typeof insertGoalUpdateSchema>;
export type GoalUpdate = typeof goalUpdatesTable.$inferSelect;
