import { Router } from "express";
import { db } from "../db";
import { candidatesTable, tokenQueueTable } from "../db";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";
import { getNextTokenNo } from "./tokens";
import { autoAssignToken } from "./queue";

const router = Router();

function generateCandidateRef(email: string, mobile: string): string {
  const emailPrefix = email.split("@")[0].replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  const mobileEnd = mobile.replace(/\D/g, "").slice(-4);
  return `${emailPrefix}-${mobileEnd}`;
}

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
          const { interviewTablesTable } = await import("../db");
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

router.post("/candidates", async (req, res) => {
  try {
    const { name, mobile, email, position, experience, currentCompany, currentDesignation, location, scheduledDate, status } = req.body;
    if (!name || !mobile || !email || !position) {
      return res.status(400).json({ error: "name, mobile, email, position required" });
    }
    const candidateRef = generateCandidateRef(email, mobile);
    const [candidate] = await db
      .insert(candidatesTable)
      .values({ candidateRef, name, mobile, email, position, experience, currentCompany, currentDesignation, location, scheduledDate, status: status || "PRE_REGISTERED" })
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
    if (mobile) {
      const digits = mobile.replace(/\D/g, "");
      // Try exact, with 91 prefix, and without 91 prefix
      const variants = new Set([digits, `91${digits}`, digits.startsWith("91") ? digits.slice(2) : digits]);
      for (const v of variants) {
        conditions.push(eq(candidatesTable.mobile, v));
      }
    }
    if (email) {
      // Case-insensitive email match
      conditions.push(ilike(candidatesTable.email, email.trim()));
    }
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
        const candidateRef = generateCandidateRef(c.email, c.mobile);
        await db.insert(candidatesTable).values({
          candidateRef,
          name: c.name,
          mobile: c.mobile,
          email: c.email,
          position: c.position,
          experience: c.experience,
          currentCompany: c.currentCompany,
          currentDesignation: c.currentDesignation,
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

router.get("/candidates/fetch-sheet", requireAuth, async (req, res) => {
  const { url } = req.query as { url: string };
  if (!url) return res.status(400).json({ error: "url required" });

  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return res.status(400).json({ error: "Invalid Google Sheets URL. Copy the share link from File → Share." });

  const sheetId = match[1];
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : "";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;

  try {
    const response = await fetch(csvUrl, { redirect: "follow" });
    if (!response.ok) {
      return res.status(400).json({ error: "Could not fetch sheet. Make sure it is shared with 'Anyone with the link can view'." });
    }
    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return res.json({ rows: [], total: 0 });

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/^"|"$/g, ""));

    const pick = (row: Record<string, string>, keys: string[]): string => {
      for (const k of keys) {
        const found = Object.keys(row).find((rk) => rk === k);
        if (found && row[found]) return row[found].trim();
      }
      return "";
    };

    const rows = lines.slice(1).map((line) => {
      const cells = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (cells[i] || "").trim().replace(/^"|"$/g, ""); });
      return {
        name: pick(row, ["name", "full name", "candidate name", "candidate"]),
        mobile: pick(row, ["mobile", "phone", "contact", "mobile number", "phone number", "mobile no", "phone no"]),
        email: pick(row, ["email", "email address", "mail", "e-mail"]),
        position: pick(row, ["position", "role", "job title", "applied for", "post", "current designation"]),
        experience: pick(row, ["experience", "exp", "years", "years of experience", "total experience"]) || undefined,
        currentCompany: pick(row, ["current company", "company", "organisation", "organization", "employer"]) || undefined,
        currentDesignation: pick(row, ["current designation", "designation", "current role", "current title"]) || undefined,
        location: pick(row, ["location", "city", "place", "current location"]) || undefined,
      };
    }).filter((r) => r.name || r.mobile || r.email);

    res.json({ rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "Fetch sheet error");
    res.status(500).json({ error: "Failed to fetch Google Sheet" });
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
    const { department, position } = req.body ?? {};

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

    // Build update payload — override dept/position if provided at check-in
    const candidateUpdate: Record<string, unknown> = {
      tokenNo,
      status: "WAITING",
      checkinTime: new Date(),
    };
    if (department) candidateUpdate.department = department;
    if (position) candidateUpdate.position = position;

    const [updated] = await db
      .update(candidatesTable)
      .set(candidateUpdate)
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
