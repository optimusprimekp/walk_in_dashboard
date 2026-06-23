import { Router } from "express";
import { db } from "@workspace/db";
import { sitePositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/site-positions", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(sitePositionsTable).orderBy(sitePositionsTable.site, sitePositionsTable.position);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "List site positions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/site-positions", requireAuth, async (req, res) => {
  try {
    const { site, position, openings } = req.body;
    if (!site || !position || openings === undefined) {
      return res.status(400).json({ error: "site, position, openings required" });
    }
    const [row] = await db
      .insert(sitePositionsTable)
      .values({ site, position, openings: Number(openings) })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Create site position error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/site-positions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { site, position, openings } = req.body;
    const updates: Record<string, unknown> = {};
    if (site !== undefined) updates.site = site;
    if (position !== undefined) updates.position = position;
    if (openings !== undefined) updates.openings = Number(openings);
    const [row] = await db.update(sitePositionsTable).set(updates).where(eq(sitePositionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Update site position error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/site-positions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(sitePositionsTable).where(eq(sitePositionsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    logger.error({ err }, "Delete site position error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
