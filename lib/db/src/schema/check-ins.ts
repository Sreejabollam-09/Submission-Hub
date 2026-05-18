import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checkInsTable = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  goalSheetId: integer("goal_sheet_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  cycleId: integer("cycle_id").notNull(),
  quarter: text("quarter", { enum: ["Q1", "Q2", "Q3", "Q4"] }).notNull(),
  status: text("status", { enum: ["pending", "in_progress", "submitted", "reviewed"] }).notNull().default("pending"),
  managerComment: text("manager_comment"),
  overallProgress: doublePrecision("overall_progress"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckInSchema = createInsertSchema(checkInsTable).omit({ id: true, createdAt: true });
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkInsTable.$inferSelect;
