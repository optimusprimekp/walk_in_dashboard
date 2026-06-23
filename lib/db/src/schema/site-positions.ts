import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sitePositionsTable = pgTable("site_positions", {
  id: serial("id").primaryKey(),
  site: text("site").notNull(),
  position: text("position").notNull(),
  openings: integer("openings").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSitePositionSchema = createInsertSchema(sitePositionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSitePosition = z.infer<typeof insertSitePositionSchema>;
export type SitePosition = typeof sitePositionsTable.$inferSelect;
