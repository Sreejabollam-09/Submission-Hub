import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const thrustAreasTable = pgTable("thrust_areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertThrustAreaSchema = createInsertSchema(thrustAreasTable).omit({ id: true, createdAt: true });
export type InsertThrustArea = z.infer<typeof insertThrustAreaSchema>;
export type ThrustArea = typeof thrustAreasTable.$inferSelect;
