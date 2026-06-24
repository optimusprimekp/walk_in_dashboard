import { db } from "../db";
import { tokenQueueTable, candidatesTable, interviewTablesTable, interviewSessionsTable, announcementsTable } from "../db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export async function autoAssignToken(): Promise<void> {
  const availableTables = await db
    .select()
    .from(interviewTablesTable)
    .where(eq(interviewTablesTable.status, "AVAILABLE"));

  if (availableTables.length === 0) return;

  const waitingTokens = await db
    .select({
      token: tokenQueueTable,
      candidate: candidatesTable,
    })
    .from(tokenQueueTable)
    .innerJoin(candidatesTable, eq(tokenQueueTable.candidateId, candidatesTable.id))
    .where(eq(tokenQueueTable.status, "WAITING"))
    .orderBy(tokenQueueTable.queuePosition);

  if (waitingTokens.length === 0) return;

  for (const availableTable of availableTables) {
    // Parse table's accepted departments (JSON array or legacy string)
    let tableDepts: string[] = [];
    try {
      if (availableTable.department) {
        const parsed = JSON.parse(availableTable.department);
        tableDepts = Array.isArray(parsed) ? parsed : [availableTable.department];
      }
    } catch {
      if (availableTable.department) tableDepts = [availableTable.department];
    }

    // Parse table's accepted positions (JSON array)
    let tablePositions: string[] = [];
    try {
      if (availableTable.positions) {
        tablePositions = JSON.parse(availableTable.positions) as string[];
      }
    } catch {
      tablePositions = [];
    }

    // Find first waiting candidate that matches this table's dept + position filters
    const matchingEntry = waitingTokens.find(({ candidate }) => {
      const deptMatch =
        tableDepts.length === 0 ||
        (candidate.department
          ? tableDepts.some(d => d.toLowerCase() === candidate.department!.toLowerCase())
          : true);

      const positionMatch =
        tablePositions.length === 0 ||
        tablePositions.some(p => p.toLowerCase() === (candidate.position || "").toLowerCase());

      return deptMatch && positionMatch;
    });

    if (!matchingEntry) continue;

    const { token: waitingToken, candidate } = matchingEntry;

    await db
      .update(tokenQueueTable)
      .set({ status: "ASSIGNED", assignedTableId: availableTable.id })
      .where(eq(tokenQueueTable.id, waitingToken.id));

    await db
      .update(candidatesTable)
      .set({ status: "ASSIGNED", assignedTableId: availableTable.id })
      .where(eq(candidatesTable.id, waitingToken.candidateId));

    const [session] = await db
      .insert(interviewSessionsTable)
      .values({
        candidateId: waitingToken.candidateId,
        tableId: availableTable.id,
        tokenNo: waitingToken.tokenNo,
        status: "PENDING",
      })
      .returning();

    await db
      .update(interviewTablesTable)
      .set({
        status: "BUSY",
        currentCandidateId: waitingToken.candidateId,
        currentSessionId: session.id,
      })
      .where(eq(interviewTablesTable.id, availableTable.id));

    await db.insert(announcementsTable).values({
      tokenNo: waitingToken.tokenNo,
      tableNo: availableTable.tableNo,
      candidateName: candidate?.name ?? "Unknown",
    });

    logger.info(
      { tokenNo: waitingToken.tokenNo, tableNo: availableTable.tableNo, dept: candidate.department },
      "Token auto-assigned"
    );
  }
}
