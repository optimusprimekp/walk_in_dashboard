import "../load-env";
import { sql, eq } from "drizzle-orm";
import {
  db,
  candidatesTable,
  tokenQueueTable,
  interviewTablesTable,
  interviewSessionsTable,
  announcementsTable,
} from "./index";

/**
 * Loads dummy candidates so the queue / calling / TV screens have data to show.
 *
 * WIPES candidates, token_queue, interview_sessions, announcements first
 * (same as db:reset), then inserts:
 *   - a couple of IN_INTERVIEW candidates (green on the calling screen)
 *   - one ASSIGNED candidate per remaining free table (orange on calling)
 *   - 110 WAITING candidates (fills the two-column waiting screen)
 *
 * Usage:  npm run db:seed:dummy
 */
const DEPT = "Solar O&M";
const POSITIONS = ["Manager", "Engineer", "Technician", "Sr Engineer", "Asst Manager", "HSE", "Store", "Jr Engineer"];
const FIRST = ["Amit", "Priya", "Rahul", "Sneha", "Vijay", "Neha", "Karan", "Pooja", "Arjun", "Riya", "Dev", "Zoya", "Manish", "Anita", "Suresh", "Kavya", "Rohit", "Megha", "Sanjay", "Divya"];
const LAST = ["Patel", "Shah", "Sharma", "Singh", "Mehta", "Joshi", "Rao", "Pillai", "Soni", "Desai"];

function tok(n: number) {
  return `T${String(n).padStart(3, "0")}`;
}

let tokenN = 0;
let queuePos = 0;

async function makeCandidate(status: string) {
  tokenN++;
  const name = `${FIRST[tokenN % FIRST.length]} ${LAST[tokenN % LAST.length]}`;
  const tokenNo = tok(tokenN);
  const position = POSITIONS[tokenN % POSITIONS.length];
  const [c] = await db
    .insert(candidatesTable)
    .values({
      name,
      mobile: `90000${String(tokenN).padStart(5, "0")}`,
      email: `dummy${tokenN}@example.com`,
      department: DEPT,
      position,
      tokenNo,
      status,
      checkinTime: new Date(),
    })
    .returning();
  return { c, tokenNo };
}

async function main() {
  await db.execute(
    sql`TRUNCATE TABLE candidates, token_queue, interview_sessions, announcements RESTART IDENTITY`,
  );

  // Ensure at least 4 interview tables exist, then free them all.
  let tables = await db.select().from(interviewTablesTable).orderBy(interviewTablesTable.tableNo);
  if (tables.length < 4) {
    for (let i = tables.length + 1; i <= 6; i++) {
      await db.insert(interviewTablesTable).values({
        tableNo: i,
        interviewerName: `Interviewer ${i}`,
        department: JSON.stringify([DEPT]),
        status: "AVAILABLE",
      });
    }
    tables = await db.select().from(interviewTablesTable).orderBy(interviewTablesTable.tableNo);
  }
  await db.update(interviewTablesTable).set({
    status: "AVAILABLE",
    currentCandidateId: null,
    currentSessionId: null,
    sessionStartTime: null,
  });

  const inInterviewCount = Math.min(2, tables.length);

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const inInterview = ti < inInterviewCount;
    const { c, tokenNo } = await makeCandidate(inInterview ? "IN_INTERVIEW" : "ASSIGNED");
    queuePos++;
    await db.insert(tokenQueueTable).values({
      tokenNo,
      candidateId: c.id,
      status: inInterview ? "IN_INTERVIEW" : "ASSIGNED",
      queuePosition: queuePos,
      assignedTableId: table.id,
      checkinTime: new Date(),
    });
    const [session] = await db
      .insert(interviewSessionsTable)
      .values({
        candidateId: c.id,
        tableId: table.id,
        tokenNo,
        status: inInterview ? "IN_PROGRESS" : "PENDING",
        startTime: inInterview ? new Date() : null,
      })
      .returning();
    await db
      .update(interviewTablesTable)
      .set({
        status: "BUSY",
        currentCandidateId: c.id,
        currentSessionId: session.id,
        sessionStartTime: inInterview ? new Date() : null,
      })
      .where(eq(interviewTablesTable.id, table.id));
    if (!inInterview) {
      await db.insert(announcementsTable).values({ tokenNo, tableNo: table.tableNo, candidateName: c.name });
    }
  }

  const waitingCount = 110;
  for (let i = 0; i < waitingCount; i++) {
    const { c, tokenNo } = await makeCandidate("WAITING");
    queuePos++;
    await db.insert(tokenQueueTable).values({
      tokenNo,
      candidateId: c.id,
      status: "WAITING",
      queuePosition: queuePos,
      checkinTime: new Date(),
    });
  }

  console.log(`Dummy data loaded: ${tables.length} at tables (${inInterviewCount} in interview), ${waitingCount} waiting.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Dummy seed failed:", err);
  process.exit(1);
});
