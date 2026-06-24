import { Router } from "express";
import { db } from "../db";
import {
  candidatesTable,
  interviewTablesTable,
  interviewSessionsTable,
  tokenQueueTable,
  announcementsTable,
} from "../db";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

async function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(candidatesTable);
  const [checkedIn] = await db
    .select({ count: sql<number>`count(*)` })
    .from(candidatesTable)
    .where(sql`${candidatesTable.checkinTime} >= ${today}`);
  const statusCounts = await db
    .select({ status: candidatesTable.status, count: sql<number>`count(*)` })
    .from(candidatesTable)
    .where(sql`${candidatesTable.checkinTime} >= ${today}`)
    .groupBy(candidatesTable.status);
  const sc: Record<string, number> = {};
  for (const row of statusCounts) sc[row.status] = Number(row.count);

  const [avgResult] = await db
    .select({ avg: sql<number>`avg(${interviewSessionsTable.duration})` })
    .from(interviewSessionsTable)
    .where(gte(interviewSessionsTable.createdAt, today));

  const [activeTables] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interviewTablesTable)
    .where(sql`${interviewTablesTable.status} != 'OFFLINE'`);

  return {
    total: Number(total.count),
    checkedIn: Number(checkedIn.count),
    waiting: sc["WAITING"] ?? 0,
    assigned: sc["ASSIGNED"] ?? 0,
    inInterview: sc["IN_INTERVIEW"] ?? 0,
    completed: (sc["COMPLETED"] ?? 0) + (sc["SELECTED"] ?? 0) + (sc["REJECTED"] ?? 0) + (sc["ON_HOLD"] ?? 0),
    selected: sc["SELECTED"] ?? 0,
    rejected: sc["REJECTED"] ?? 0,
    onHold: sc["ON_HOLD"] ?? 0,
    noShow: sc["NO_SHOW"] ?? 0,
    avgInterviewTime: Number(avgResult?.avg ?? 0),
    activeTables: Number(activeTables.count),
  };
}

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    res.json(await getStats());
  } catch (err) {
    logger.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/tv", async (req, res) => {
  try {
    const tokens = await db
      .select()
      .from(tokenQueueTable)
      .where(sql`${tokenQueueTable.status} in ('WAITING', 'ASSIGNED', 'IN_INTERVIEW')`)
      .orderBy(tokenQueueTable.queuePosition)
      .limit(20);

    const enrichedTokens = await Promise.all(
      tokens.map(async (token) => {
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
      }),
    );

    const tables = await db.select().from(interviewTablesTable).orderBy(interviewTablesTable.tableNo);
    const enrichedTables = await Promise.all(
      tables.map(async (table) => {
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
      }),
    );

    const nowCalling = enrichedTokens.filter((t) => t.status === "ASSIGNED").slice(0, 10);
    const stats = await getStats();

    res.json({ tokens: enrichedTokens, tables: enrichedTables, nowCalling, stats });
  } catch (err) {
    logger.error({ err }, "TV display error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/hourly", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const results = await db
      .select({
        hour: sql<string>`to_char(${interviewSessionsTable.startTime}, 'HH24:00')`,
        count: sql<number>`count(*)`,
      })
      .from(interviewSessionsTable)
      .where(gte(interviewSessionsTable.createdAt, today))
      .groupBy(sql`to_char(${interviewSessionsTable.startTime}, 'HH24:00')`)
      .orderBy(sql`to_char(${interviewSessionsTable.startTime}, 'HH24:00')`);
    res.json(results.map((r) => ({ hour: r.hour, count: Number(r.count) })));
  } catch (err) {
    logger.error({ err }, "Hourly stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/positions", requireAuth, async (req, res) => {
  try {
    const results = await db
      .select({
        position: candidatesTable.position,
        count: sql<number>`count(*)`,
      })
      .from(candidatesTable)
      .groupBy(candidatesTable.position)
      .orderBy(sql`count(*) desc`);
    res.json(results.map((r) => ({ position: r.position, count: Number(r.count) })));
  } catch (err) {
    logger.error({ err }, "Position stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/announcements", async (req, res) => {
  try {
    const announcements = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.createdAt))
      .limit(10);
    res.json(
      announcements.map((a) => ({
        ...a,
        timestamp: a.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    logger.error({ err }, "Announcements error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
