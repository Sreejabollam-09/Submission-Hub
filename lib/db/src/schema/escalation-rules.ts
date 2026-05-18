import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const escalationRulesTable = pgTable("escalation_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  triggerType: text("trigger_type", {
    enum: ["no_submission", "no_approval", "no_checkin"],
  }).notNull(),
  thresholdDays: integer("threshold_days").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const escalationLogsTable = pgTable("escalation_logs", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull(),
  userId: integer("user_id").notNull(),
  cycleId: integer("cycle_id").notNull(),
  escalationLevel: text("escalation_level", { enum: ["employee", "manager", "hr"] }).notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEscalationRuleSchema = createInsertSchema(escalationRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEscalationRule = z.infer<typeof insertEscalationRuleSchema>;
export type EscalationRule = typeof escalationRulesTable.$inferSelect;

export const insertEscalationLogSchema = createInsertSchema(escalationLogsTable).omit({ id: true, createdAt: true });
export type InsertEscalationLog = z.infer<typeof insertEscalationLogSchema>;
export type EscalationLog = typeof escalationLogsTable.$inferSelect;
