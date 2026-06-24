import "../load-env";
import { sql } from "drizzle-orm";
import { db, interviewTablesTable } from "./index";

/**
 * Resets event/runtime data for a fresh interview day.
 *
 * CLEARS:   candidates, token_queue, interview_sessions, announcements
 * RESETS:   all interview_tables back to AVAILABLE (no current candidate/session)
 * KEEPS:    users, interview_tables definitions, site_positions
 *
 * Token numbers restart at T001 (they are derived from today's token count).
 *
 * Usage:  npm run db:reset
 */
async function main() {
  await db.execute(
    sql`TRUNCATE TABLE candidates, token_queue, interview_sessions, announcements RESTART IDENTITY`,
  );

  await db.update(interviewTablesTable).set({
    status: "AVAILABLE",
    currentCandidateId: null,
    currentSessionId: null,
    sessionStartTime: null,
  });

  console.log(
    "Reset complete: cleared candidates, tokens, interview sessions, and announcements; all tables set to AVAILABLE.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
