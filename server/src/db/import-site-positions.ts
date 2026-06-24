import "../load-env";
import * as path from "node:path";
import { createRequire } from "node:module";
import { and, eq } from "drizzle-orm";
import { db, sitePositionsTable } from "./index";

// SheetJS ships as CommonJS; the ESM build it resolves under `import * as`
// omits `readFile` (filesystem access). Load the CJS build so `readFile` works.
const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

/**
 * Bulk-import the O&M manpower sheet into the site_positions table.
 *
 * Usage:
 *   npm run import:sites -- ./sites.xlsx
 *   npm run import:sites -- ./sites.csv
 *
 * Expected columns (in this order), with one header row:
 *   SN | Segment | Client/Project | Location | Capacity MWp |
 *   Manager | Dy Manager | Asst Manager | Sr Engineer | Engineer | Jr. Engineer |
 *   Sr.Technician | Technician | Cleaning Supervisor | Jointer | Store | HSE | Admin | Asst |
 *   SCADA Sr Engineer | SCADA Engineer | SCADA Jr Engineer | SCADA Technician | Total
 *
 * Grouping decisions (per request):
 *   department = "Solar O&M"
 *   site       = "<Client/Project> — <Location>"
 *   position   = the role column name (SCADA roles get a " (SCADA)" suffix)
 *   openings   = the integer in that cell (cells with 0/blank are skipped)
 */

const DEPARTMENT = "Solar O&M";

// Column index (0-based) -> position label. Index matches the sheet layout.
const POSITION_COLUMNS: Array<{ col: number; label: string }> = [
  { col: 5, label: "Manager" },
  { col: 6, label: "Dy Manager" },
  { col: 7, label: "Asst Manager" },
  { col: 8, label: "Sr Engineer" },
  { col: 9, label: "Engineer" },
  { col: 10, label: "Jr Engineer" },
  { col: 11, label: "Sr Technician" },
  { col: 12, label: "Technician" },
  { col: 13, label: "Cleaning Supervisor" },
  { col: 14, label: "Jointer" },
  { col: 15, label: "Store" },
  { col: 16, label: "HSE" },
  { col: 17, label: "Admin" },
  { col: 18, label: "Asst" },
  { col: 19, label: "Sr Engineer (SCADA)" },
  { col: 20, label: "Engineer (SCADA)" },
  { col: 21, label: "Jr Engineer (SCADA)" },
  { col: 22, label: "Technician (SCADA)" },
];
const TOTAL_COL = 23;

function toInt(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function cellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run import:sites -- <path-to-.xlsx-or-.csv>");
    process.exit(1);
  }

  const wb = XLSX.readFile(path.resolve(file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });

  let inserted = 0;
  let updated = 0;
  const warnings: string[] = [];

  for (const row of rows) {
    // Data rows have a numeric SN in the first column; header rows do not.
    const sn = toInt(row[0]);
    if (sn <= 0) continue;

    const project = cellText(row[2]);
    const location = cellText(row[3]);
    const site = project && location ? `${project} — ${location}` : project || location;
    if (!site) continue;

    let rowSum = 0;
    for (const { col, label } of POSITION_COLUMNS) {
      const openings = toInt(row[col]);
      if (openings <= 0) continue;
      rowSum += openings;

      const [existing] = await db
        .select()
        .from(sitePositionsTable)
        .where(
          and(
            eq(sitePositionsTable.department, DEPARTMENT),
            eq(sitePositionsTable.site, site),
            eq(sitePositionsTable.position, label),
          ),
        );

      if (existing) {
        await db
          .update(sitePositionsTable)
          .set({ openings })
          .where(eq(sitePositionsTable.id, existing.id));
        updated++;
      } else {
        await db
          .insert(sitePositionsTable)
          .values({ department: DEPARTMENT, site, position: label, openings });
        inserted++;
      }
    }

    // Cross-check against the sheet's own Total column when present.
    const declaredTotal = toInt(row[TOTAL_COL]);
    if (declaredTotal > 0 && declaredTotal !== rowSum) {
      warnings.push(
        `Row ${sn} (${site}): row total ${rowSum} != sheet Total ${declaredTotal}`,
      );
    }
  }

  console.log(`Imported site positions: ${inserted} inserted, ${updated} updated.`);
  if (warnings.length) {
    console.log("\nTotals mismatches (please review the source sheet):");
    for (const w of warnings) console.log("  - " + w);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
