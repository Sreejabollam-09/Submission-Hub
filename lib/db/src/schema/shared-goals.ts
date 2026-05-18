import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sharedGoalsTable = pgTable("shared_goals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  thrustAreaId: integer("thrust_area_id").notNull(),
  target: text("target").notNull(),
  uomType: text("uom_type", { enum: ["numeric_min", "numeric_max", "timeline", "zero"] }).notNull(),
  cycleId: integer("cycle_id").notNull(),
  ownerEmployeeId: integer("owner_employee_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSharedGoalSchema = createInsertSchema(sharedGoalsTable).omit({ id: true, createdAt: true });
export type InsertSharedGoal = z.infer<typeof insertSharedGoalSchema>;
export type SharedGoal = typeof sharedGoalsTable.$inferSelect;
