import { db } from "@workspace/db";
import { tokenQueueTable, candidatesTable, interviewTablesTable, interviewSessionsTable, announcementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export async function autoAssignToken(): Promise<void> {
  const [availableTable] = await db
    .select()
    .from(interviewTablesTable)
    .where(eq(interviewTablesTable.status, "AVAILABLE"))
    .limit(1);
  if (!availableTable) return;

  const [waitingToken] = await db
    .select()
    .from(tokenQueueTable)
    .where(eq(tokenQueueTable.status, "WAITING"))
    .orderBy(tokenQueueTable.queuePosition)
    .limit(1);
  if (!waitingToken) return;

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

  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, waitingToken.candidateId));

  await db.insert(announcementsTable).values({
    tokenNo: waitingToken.tokenNo,
    tableNo: availableTable.tableNo,
    candidateName: candidate?.name ?? "Unknown",
  });

  logger.info({ tokenNo: waitingToken.tokenNo, tableNo: availableTable.tableNo }, "Token auto-assigned");
}
