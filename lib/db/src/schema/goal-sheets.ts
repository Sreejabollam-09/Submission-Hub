import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalSheetsTable = pgTable("goal_sheets", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  cycleId: integer("cycle_id").notNull(),
  status: text("status", { enum: ["draft", "submitted", "approved", "returned"] }).notNull().default("draft"),
  managerComment: text("manager_comment"),
  isLocked: boolean("is_locked").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGoalSheetSchema = createInsertSchema(goalSheetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoalSheet = z.infer<typeof insertGoalSheetSchema>;
export type GoalSheet = typeof goalSheetsTable.$inferSelect;
