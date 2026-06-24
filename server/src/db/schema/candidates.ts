import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  candidateRef: text("candidate_ref"),
  tokenNo: text("token_no"),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email").notNull(),
  department: text("department"),
  position: text("position").notNull(),
  experience: text("experience"),
  currentCompany: text("current_company"),
  currentDesignation: text("current_designation"),
  currentCtc: text("current_ctc"),
  negotiatedCtc: text("negotiated_ctc"),
  noticePeriod: integer("notice_period"),
  selectedSite: text("selected_site"),
  selectedPosition: text("selected_position"),
  remarks: text("remarks"),
  resumeUrl: text("resume_url"),
  status: text("status").notNull().default("PRE_REGISTERED"),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  location: text("location"),
  checkinTime: timestamp("checkin_time", { withTimezone: true }),
  assignedTableId: integer("assigned_table_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
