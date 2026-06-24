import { Router } from "express";
import { db } from "../db";
import {
  interviewSessionsTable,
  candidatesTable,
  interviewTablesTable,
  tokenQueueTable,
} from "../db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";
import { autoAssignToken } from "./queue";

const router = Router();

async function enrichSession(session: any) {
  const [candidate] = await db
    .select({ name: candidatesTable.name, position: candidatesTable.position, tokenNo: candidatesTable.tokenNo })
    .from(candidatesTable)
    .where(eq(candidatesTable.id, session.candidateId));
  const [table] = await db
    .select({ tableNo: interviewTablesTable.tableNo })
    .from(interviewTablesTable)
    .where(eq(interviewTablesTable.id, session.tableId));
  return {
    ...session,
    candidateName: candidate?.name ?? "Unknown",
    position: candidate?.position ?? "",
    tokenNo: session.tokenNo ?? candidate?.tokenNo ?? "",
    tableNo: table?.tableNo ?? 0,
    startTime: session.startTime?.toISOString() ?? null,
    endTime: session.endTime?.toISOString() ?? null,
  };
}

router.get("/sessions", requireAuth, async (req: any, res) => {
  try {
    const { date, tableId, result } = req.query as Record<string, string>;
    let query = db.select().from(interviewSessionsTable).$dynamic();
    const conditions = [];
    if (tableId) conditions.push(eq(interviewSessionsTable.tableId, parseInt(tableId)));
    if (result) conditions.push(eq(interviewSessionsTable.result, result));
    if (conditions.length > 0) query = query.where(and(...conditions));
    query = query.orderBy(interviewSessionsTable.createdAt);
    const sessions = await query;
    const enriched = await Promise.all(sessions.map(enrichSession));
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "List sessions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sessions/:id/start", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date();
    const [session] = await db
      .update(interviewSessionsTable)
      .set({ status: "IN_PROGRESS", startTime: now })
      .where(eq(interviewSessionsTable.id, id))
      .returning();
    if (!session) return res.status(404).json({ error: "Session not found" });

    await db
      .update(interviewTablesTable)
      .set({ sessionStartTime: now })
      .where(eq(interviewTablesTable.id, session.tableId));

    await db
      .update(candidatesTable)
      .set({ status: "IN_INTERVIEW" })
      .where(eq(candidatesTable.id, session.candidateId));

    await db
      .update(tokenQueueTable)
      .set({ status: "IN_INTERVIEW" })
      .where(eq(tokenQueueTable.candidateId, session.candidateId));

    res.json(await enrichSession(session));
  } catch (err) {
    logger.error({ err }, "Start session error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sessions/:id/end", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { result, remarks, selectedSite, selectedPosition, currentCtc, negotiatedCtc } = req.body;
    if (!result) return res.status(400).json({ error: "result required" });
    if (!remarks || !remarks.trim()) return res.status(400).json({ error: "remarks required — please add a comment before ending the session" });
    const now = new Date();
    const [existing] = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Session not found" });
    const duration = existing.startTime
      ? Math.round((now.getTime() - existing.startTime.getTime()) / 1000)
      : null;

    const [session] = await db
      .update(interviewSessionsTable)
      .set({
        status: "COMPLETED",
        endTime: now,
        duration,
        result,
        remarks,
        selectedSite: selectedSite || null,
        selectedPosition: selectedPosition || null,
        currentCtc: currentCtc || null,
        negotiatedCtc: negotiatedCtc || null,
      })
      .where(eq(interviewSessionsTable.id, id))
      .returning();

    const candidateStatus = result === "SELECTED" ? "SELECTED" : result === "REJECTED" ? "REJECTED" : "ON_HOLD";
    const candidateUpdate: Record<string, unknown> = { status: candidateStatus };
    if (remarks) candidateUpdate.remarks = remarks;
    if (result === "SELECTED") {
      if (selectedSite) candidateUpdate.selectedSite = selectedSite;
      if (selectedPosition) candidateUpdate.selectedPosition = selectedPosition;
      if (currentCtc) candidateUpdate.currentCtc = currentCtc;
      if (negotiatedCtc) candidateUpdate.negotiatedCtc = negotiatedCtc;
    }

    await db
      .update(candidatesTable)
      .set(candidateUpdate)
      .where(eq(candidatesTable.id, session.candidateId));

    await db
      .update(tokenQueueTable)
      .set({ status: "COMPLETED" })
      .where(eq(tokenQueueTable.candidateId, session.candidateId));

    await db
      .update(interviewTablesTable)
      .set({
        status: "AVAILABLE",
        currentCandidateId: null,
        currentSessionId: null,
        sessionStartTime: null,
      })
      .where(eq(interviewTablesTable.id, session.tableId));

    setTimeout(() => {
      autoAssignToken().catch((e) => logger.error({ err: e }, "Auto assign after session end error"));
    }, 2000);

    res.json(await enrichSession(session));
  } catch (err) {
    logger.error({ err }, "End session error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Park the candidate at the table: the session is held (not ended) and the
// table stays BUSY so no new candidate is auto-assigned until resume.
router.post("/sessions/:id/hold", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { remarks } = req.body ?? {};
    const [session] = await db
      .update(interviewSessionsTable)
      .set({ status: "ON_HOLD", ...(remarks && remarks.trim() ? { remarks } : {}) })
      .where(eq(interviewSessionsTable.id, id))
      .returning();
    if (!session) return res.status(404).json({ error: "Session not found" });

    await db
      .update(tokenQueueTable)
      .set({ status: "ON_HOLD" })
      .where(eq(tokenQueueTable.candidateId, session.candidateId));

    res.json(await enrichSession(session));
  } catch (err) {
    logger.error({ err }, "Hold session error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resume a held session back into the live interview.
router.post("/sessions/:id/resume", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .update(interviewSessionsTable)
      .set({ status: "IN_PROGRESS" })
      .where(eq(interviewSessionsTable.id, id))
      .returning();
    if (!session) return res.status(404).json({ error: "Session not found" });

    await db
      .update(tokenQueueTable)
      .set({ status: "IN_INTERVIEW" })
      .where(eq(tokenQueueTable.candidateId, session.candidateId));

    res.json(await enrichSession(session));
  } catch (err) {
    logger.error({ err }, "Resume session error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sessions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.id, id));
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(await enrichSession(session));
  } catch (err) {
    logger.error({ err }, "Get session error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
