import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  tableId: integer("table_id").notNull(),
  tokenNo: text("token_no"),
  status: text("status").notNull().default("PENDING"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  duration: integer("duration"),
  result: text("result"),
  remarks: text("remarks"),
  selectedSite: text("selected_site"),
  selectedPosition: text("selected_position"),
  currentCtc: text("current_ctc"),
  negotiatedCtc: text("negotiated_ctc"),
  noticePeriod: integer("notice_period"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSessionSchema = createInsertSchema(interviewSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
