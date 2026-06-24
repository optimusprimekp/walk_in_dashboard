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

router.get("/tables/routing-options", async (_req, res) => {
  try {
    const tables = await db
      .select({ department: interviewTablesTable.department, positions: interviewTablesTable.positions })
      .from(interviewTablesTable)
      .where(eq(interviewTablesTable.status, "AVAILABLE"));

    // Also include BUSY tables so options show even when all panels are occupied
    const allTables = await db
      .select({ department: interviewTablesTable.department, positions: interviewTablesTable.positions })
      .from(interviewTablesTable);

    const departmentsSet = new Set<string>();
    const positionsByDept: Record<string, Set<string>> = {};

    for (const t of allTables) {
      let depts: string[] = [];
      try {
        if (t.department) {
          const parsed = JSON.parse(t.department);
          depts = Array.isArray(parsed) ? parsed : [t.department];
        }
      } catch {
        if (t.department) depts = [t.department];
      }

      let positions: string[] = [];
      try {
        if (t.positions) {
          positions = JSON.parse(t.positions) as string[];
        }
      } catch {
        positions = [];
      }

      for (const dept of depts) {
        departmentsSet.add(dept);
        if (!positionsByDept[dept]) positionsByDept[dept] = new Set<string>();
        for (const pos of positions) {
          positionsByDept[dept].add(pos);
        }
      }
    }

    const result = {
      departments: Array.from(departmentsSet).sort(),
      positionsByDept: Object.fromEntries(
        Object.entries(positionsByDept).map(([dept, posSet]) => [dept, Array.from(posSet).sort()])
      ),
    };

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Routing options error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
