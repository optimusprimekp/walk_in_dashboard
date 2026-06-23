import { Router } from "express";
import { db } from "@workspace/db";
import { interviewTablesTable, candidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";
import { autoAssignToken } from "./queue";

const router = Router();

async function enrichTable(table: any) {
  let currentCandidateName = null;
  let currentTokenNo = null;
  if (table.currentCandidateId) {
    const [candidate] = await db
      .select({ name: candidatesTable.name, tokenNo: candidatesTable.tokenNo })
      .from(candidatesTable)
      .where(eq(candidatesTable.id, table.currentCandidateId));
    currentCandidateName = candidate?.name ?? null;
    currentTokenNo = candidate?.tokenNo ?? null;
  }
  return {
    ...table,
    currentCandidateName,
    currentTokenNo,
    sessionStartTime: table.sessionStartTime?.toISOString() ?? null,
  };
}

router.get("/tables", requireAuth, async (req, res) => {
  try {
    const tables = await db.select().from(interviewTablesTable).orderBy(interviewTablesTable.tableNo);
    const enriched = await Promise.all(tables.map(enrichTable));
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "List tables error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tables", requireAuth, async (req, res) => {
  try {
    const { tableNo, interviewerName, department, status, positions } = req.body;
    if (!tableNo) return res.status(400).json({ error: "tableNo required" });
    const [table] = await db
      .insert(interviewTablesTable)
      .values({ tableNo, interviewerName, department, status: status || "AVAILABLE", positions: positions || null })
      .returning();
    res.status(201).json(await enrichTable(table));
  } catch (err) {
    logger.error({ err }, "Create table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tables/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = {};
    const allowed = ["tableNo", "interviewerName", "department", "status", "positions"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const prevStatus = req.body.status;
    if (prevStatus === "AVAILABLE") {
      updates.currentCandidateId = null;
      updates.currentSessionId = null;
      updates.sessionStartTime = null;
    }
    const [table] = await db.update(interviewTablesTable).set(updates).where(eq(interviewTablesTable.id, id)).returning();
    if (!table) return res.status(404).json({ error: "Table not found" });

    if (prevStatus === "AVAILABLE") {
      setTimeout(() => {
        autoAssignToken().catch((e) => logger.error({ err: e }, "Auto assign on table available error"));
      }, 500);
    }

    res.json(await enrichTable(table));
  } catch (err) {
    logger.error({ err }, "Update table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tables/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(interviewTablesTable).where(eq(interviewTablesTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Table not found" });
    res.json({ success: true, message: "Table deleted" });
  } catch (err) {
    logger.error({ err }, "Delete table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
