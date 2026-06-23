import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tokenQueueTable = pgTable("token_queue", {
  id: serial("id").primaryKey(),
  tokenNo: text("token_no").notNull(),
  candidateId: integer("candidate_id").notNull(),
  status: text("status").notNull().default("WAITING"),
  queuePosition: integer("queue_position").notNull(),
  assignedTableId: integer("assigned_table_id"),
  checkinTime: timestamp("checkin_time", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTokenSchema = createInsertSchema(tokenQueueTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokenQueueTable.$inferSelect;
