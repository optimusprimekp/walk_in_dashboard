import { Router } from "express";
import { db } from "../db";
import { tokenQueueTable, candidatesTable, interviewTablesTable } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";
import { autoAssignToken } from "./queue";

const router = Router();

export async function getNextTokenNo(): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tokenQueueTable)
    .where(sql`${tokenQueueTable.createdAt} >= ${today}`);
  const count = Number(result?.count ?? 0) + 1;
  return `T${String(count).padStart(3, "0")}`;
}

async function enrichToken(token: any) {
  const [candidate] = await db
    .select({ name: candidatesTable.name, position: candidatesTable.position })
    .from(candidatesTable)
    .where(eq(candidatesTable.id, token.candidateId));
  let assignedTableNo = null;
  if (token.assignedTableId) {
    const [table] = await db
      .select({ tableNo: interviewTablesTable.tableNo })
      .from(interviewTablesTable)
      .where(eq(interviewTablesTable.id, token.assignedTableId));
    assignedTableNo = table?.tableNo ?? null;
  }
  return {
    ...token,
    candidateName: candidate?.name ?? "Unknown",
    position: candidate?.position ?? "",
    assignedTableNo,
  };
}

router.get("/tokens", requireAuth, async (req: any, res) => {
  try {
    const { status, limit } = req.query as Record<string, string>;
    let query = db.select().from(tokenQueueTable).$dynamic();
    if (status) query = query.where(eq(tokenQueueTable.status, status));
    if (limit) query = query.limit(parseInt(limit));
    query = query.orderBy(tokenQueueTable.queuePosition);
    const tokens = await query;
    const enriched = await Promise.all(tokens.map(enrichToken));
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "List tokens error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tokens/next", requireAuth, async (req, res) => {
  try {
    await autoAssignToken();
    const [token] = await db
      .select()
      .from(tokenQueueTable)
      .where(eq(tokenQueueTable.status, "ASSIGNED"))
      .orderBy(tokenQueueTable.updatedAt)
      .limit(1);
    if (!token) return res.status(404).json({ error: "No tokens assigned or no available tables" });
    res.json(await enrichToken(token));
  } catch (err) {
    logger.error({ err }, "Assign next token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tokens/reset", requireAuth, async (req, res) => {
  try {
    await db.update(tokenQueueTable).set({ status: "COMPLETED" }).where(eq(tokenQueueTable.status, "WAITING"));
    res.json({ success: true, message: "Daily tokens reset" });
  } catch (err) {
    logger.error({ err }, "Reset tokens error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tokens/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [token] = await db.select().from(tokenQueueTable).where(eq(tokenQueueTable.id, id));
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(await enrichToken(token));
  } catch (err) {
    logger.error({ err }, "Get token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tokens/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, assignedTableId } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (assignedTableId !== undefined) updates.assignedTableId = assignedTableId;
    const [token] = await db.update(tokenQueueTable).set(updates).where(eq(tokenQueueTable.id, id)).returning();
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(await enrichToken(token));
  } catch (err) {
    logger.error({ err }, "Update token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
