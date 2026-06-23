import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewTablesTable = pgTable("interview_tables", {
  id: serial("id").primaryKey(),
  tableNo: integer("table_no").notNull().unique(),
  interviewerName: text("interviewer_name"),
  department: text("department"),
  status: text("status").notNull().default("AVAILABLE"),
  currentCandidateId: integer("current_candidate_id"),
  currentSessionId: integer("current_session_id"),
  sessionStartTime: timestamp("session_start_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTableSchema = createInsertSchema(interviewTablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type InterviewTable = typeof interviewTablesTable.$inferSelect;
