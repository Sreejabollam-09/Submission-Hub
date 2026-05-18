import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type", {
    enum: [
      "goal_submitted", "goal_approved", "goal_returned",
      "checkin_submitted", "checkin_reminder",
      "escalation_employee", "escalation_manager", "escalation_hr",
    ],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  channel: text("channel", { enum: ["in_app", "email", "teams"] }).notNull().default("in_app"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: integer("related_entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, sentAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
