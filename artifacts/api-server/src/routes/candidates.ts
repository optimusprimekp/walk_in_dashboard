import { Router } from "express";
import { db } from "@workspace/db";
import { candidatesTable, tokenQueueTable } from "@workspace/db";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";
import { getNextTokenNo } from "./tokens";
import { autoAssignToken } from "./queue";

const router = Router();

router.get("/candidates", requireAuth, async (req: any, res) => {
  try {
    const { status, date, search, position } = req.query as Record<string, string>;
    let query = db.select().from(candidatesTable).$dynamic();
    const conditions = [];
    if (status) conditions.push(eq(candidatesTable.status, status));
    if (date) conditions.push(eq(candidatesTable.scheduledDate, date));
    if (position) conditions.push(ilike(candidatesTable.position, `%${position}%`));
    if (search) {
      conditions.push(
        or(
          ilike(candidatesTable.name, `%${search}%`),
          ilike(candidatesTable.mobile, `%${search}%`),
          ilike(candidatesTable.email, `%${search}%`),
        )!,
      );
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    const candidates = await query.orderBy(candidatesTable.createdAt);
    const result = await Promise.all(
      candidates.map(async (c) => {
        let assignedTableNo = null;
        if (c.assignedTableId) {
          const { interviewTablesTable } = await import("@workspace/db");
          const [table] = await db
            .select({ tableNo: interviewTablesTable.tableNo })
            .from(interviewTablesTable)
            .where(eq(interviewTablesTable.id, c.assignedTableId));
          assignedTableNo = table?.tableNo ?? null;
        }
        return { ...c, assignedTableNo };
      }),
    );
    res.json(result);
  } catch (err) {
    logger.error({ err }, "List candidates error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/candidates", requireAuth, async (req, res) => {
  try {
    const { name, mobile, email, position, experience, location, scheduledDate, status } = req.body;
    if (!name || !mobile || !email || !position) {
      return res.status(400).json({ error: "name, mobile, email, position required" });
    }
    const [candidate] = await db
      .insert(candidatesTable)
      .values({ name, mobile, email, position, experience, location, scheduledDate, status: status || "PRE_REGISTERED" })
      .returning();
    res.status(201).json({ ...candidate, assignedTableNo: null });
  } catch (err) {
    logger.error({ err }, "Create candidate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/candidates/lookup", async (req, res) => {
  try {
    const { mobile, email } = req.body;
    if (!mobile && !email) {
      return res.status(400).json({ error: "Provide mobile or email" });
    }
    const conditions = [];
    if (mobile) conditions.push(eq(candidatesTable.mobile, mobile));
    if (email) conditions.push(eq(candidatesTable.email, email));
    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(or(...conditions)!);
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json({ ...candidate, assignedTableNo: null });
  } catch (err) {
    logger.error({ err }, "Lookup candidate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/candidates/import", requireAuth, async (req, res) => {
  try {
    const { candidates, scheduledDate } = req.body;
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ error: "candidates must be an array" });
    }
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const c of candidates) {
      try {
        if (!c.name || !c.mobile || !c.email || !c.position) {
          skipped++;
          errors.push(`Skipped: missing required fields for ${c.name || "unknown"}`);
          continue;
        }
        const [existing] = await db
          .select()
          .from(candidatesTable)
          .where(or(eq(candidatesTable.mobile, c.mobile), eq(candidatesTable.email, c.email))!);
        if (existing) {
          skipped++;
          continue;
        }
        await db.insert(candidatesTable).values({
          name: c.name,
          mobile: c.mobile,
          email: c.email,
          position: c.position,
          experience: c.experience,
          location: c.location,
          scheduledDate: scheduledDate || c.scheduledDate,
          status: "PRE_REGISTERED",
        });
        imported++;
      } catch {
        skipped++;
        errors.push(`Error importing ${c.name || "unknown"}`);
      }
    }
    res.json({ imported, skipped, total: candidates.length, errors });
  } catch (err) {
    logger.error({ err }, "Import candidates error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/candidates/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, id));
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json({ ...candidate, assignedTableNo: null });
  } catch (err) {
    logger.error({ err }, "Get candidate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/candidates/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = {};
    const allowed = ["name", "mobile", "email", "position", "experience", "status", "location", "scheduledDate"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const [candidate] = await db
      .update(candidatesTable)
      .set(updates)
      .where(eq(candidatesTable.id, id))
      .returning();
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json({ ...candidate, assignedTableNo: null });
  } catch (err) {
    logger.error({ err }, "Update candidate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/candidates/:id/checkin", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, id));
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    if (candidate.status === "WAITING" || candidate.status === "ASSIGNED" || candidate.status === "IN_INTERVIEW") {
      return res.json({
        candidate: { ...candidate, assignedTableNo: null },
        tokenNo: candidate.tokenNo,
        message: "Already checked in",
      });
    }
    const tokenNo = await getNextTokenNo();
    const [existingTokens] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenQueueTable)
      .where(eq(tokenQueueTable.status, "WAITING"));
    const queuePosition = Number(existingTokens?.count ?? 0) + 1;
    await db.insert(tokenQueueTable).values({
      tokenNo,
      candidateId: id,
      status: "WAITING",
      queuePosition,
      checkinTime: new Date(),
    });
    const [updated] = await db
      .update(candidatesTable)
      .set({ tokenNo, status: "WAITING", checkinTime: new Date() })
      .where(eq(candidatesTable.id, id))
      .returning();
    autoAssignToken().catch((e) => logger.error({ err: e }, "Auto assign error"));
    res.json({ candidate: { ...updated, assignedTableNo: null }, tokenNo, message: `Token ${tokenNo} generated` });
  } catch (err) {
    logger.error({ err }, "Checkin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
