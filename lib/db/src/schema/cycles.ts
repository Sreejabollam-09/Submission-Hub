import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalCyclesTable = pgTable("goal_cycles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  status: text("status", { enum: ["upcoming", "active", "closed"] }).notNull().default("upcoming"),
  goalSettingStart: timestamp("goal_setting_start", { withTimezone: true }).notNull(),
  goalSettingEnd: timestamp("goal_setting_end", { withTimezone: true }).notNull(),
  q1Start: timestamp("q1_start", { withTimezone: true }),
  q1End: timestamp("q1_end", { withTimezone: true }),
  q2Start: timestamp("q2_start", { withTimezone: true }),
  q2End: timestamp("q2_end", { withTimezone: true }),
  q3Start: timestamp("q3_start", { withTimezone: true }),
  q3End: timestamp("q3_end", { withTimezone: true }),
  q4Start: timestamp("q4_start", { withTimezone: true }),
  q4End: timestamp("q4_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGoalCycleSchema = createInsertSchema(goalCyclesTable).omit({ id: true, createdAt: true });
export type InsertGoalCycle = z.infer<typeof insertGoalCycleSchema>;
export type GoalCycle = typeof goalCyclesTable.$inferSelect;
