// Simple load test — no dependencies, uses Node's built-in fetch (Node 18+).
//
// Usage:
//   node loadtest/run.mjs --url=https://kpwalk-in.pxoms.in --concurrency=5000 --scenario=checkin
//   npm run loadtest -- --url=http://localhost:3001 --concurrency=5000 --scenario=checkin
//
// Scenarios:
//   health    GET  /api/healthz                 (pure server throughput, no DB)
//   read      GET  /api/dashboard/tv            (DB read load)
//   register  POST /api/candidates              (DB write load)
//   checkin   POST /api/candidates + /checkin   (token generation under load) [default]
//
// Options:
//   --concurrency=N   how many virtual requests to run (default 5000)
//   --batch=N         max requests in flight at once (default = concurrency, i.e. all at once)
//
// NOTE: the "checkin"/"register" scenarios create real rows. Run `npm run db:reset`
// afterwards to clean up the test data.
import { performance } from "node:perf_hooks";

function arg(name, def) {
  const pfx = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pfx));
  if (hit) return hit.slice(pfx.length);
  return process.env[name.toUpperCase()] ?? def;
}

const BASE = String(arg("url", "http://localhost:3001")).replace(/\/+$/, "");
const CONCURRENCY = Number(arg("concurrency", 5000));
const SCENARIO = arg("scenario", "checkin");
const BATCH = Number(arg("batch", CONCURRENCY));
const runId = Date.now().toString().slice(-7);
const JSON_HEADERS = { "content-type": "application/json" };

async function timed(fn) {
  const t = performance.now();
  try {
    const r = await fn();
    return { ...r, ms: performance.now() - t };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e), ms: performance.now() - t };
  }
}

const scenarios = {
  async health() {
    const r = await fetch(`${BASE}/api/healthz`);
    return { ok: r.ok, status: r.status };
  },
  async read() {
    const r = await fetch(`${BASE}/api/dashboard/tv`);
    return { ok: r.ok, status: r.status };
  },
  async register(i) {
    const r = await fetch(`${BASE}/api/candidates`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: `Load ${runId}-${i}`,
        mobile: `9${runId}${String(i).padStart(5, "0")}`,
        email: `load_${runId}_${i}@test.local`,
        position: "Engineer",
      }),
    });
    return { ok: r.ok, status: r.status };
  },
  async checkin(i) {
    const cr = await fetch(`${BASE}/api/candidates`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: `Load ${runId}-${i}`,
        mobile: `9${runId}${String(i).padStart(5, "0")}`,
        email: `load_${runId}_${i}@test.local`,
        position: "Engineer",
      }),
    });
    if (!cr.ok) return { ok: false, status: cr.status, step: "create" };
    const c = await cr.json();
    const kr = await fetch(`${BASE}/api/candidates/${c.id}/checkin`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ department: "Solar O&M", position: "Engineer" }),
    });
    let token = null;
    try { token = (await kr.json())?.tokenNo ?? null; } catch { /* ignore */ }
    return { ok: kr.ok, status: kr.status, token };
  },
};

async function main() {
  const scenario = scenarios[SCENARIO];
  if (!scenario) {
    console.error(`Unknown scenario "${SCENARIO}". Options: ${Object.keys(scenarios).join(", ")}`);
    process.exit(1);
  }
  console.log(`Load test → ${BASE}`);
  console.log(`  scenario=${SCENARIO}  concurrency=${CONCURRENCY}  batch=${BATCH}\n`);

  const results = [];
  const start = performance.now();
  let idx = 0;
  while (idx < CONCURRENCY) {
    const wave = [];
    const end = Math.min(idx + BATCH, CONCURRENCY);
    for (; idx < end; idx++) wave.push(timed(() => scenario(idx)));
    results.push(...(await Promise.all(wave)));
  }
  const totalMs = performance.now() - start;

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))].toFixed(0) : "0");
  const avg = lat.length ? (lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(0) : "0";

  console.log(`Done in ${(totalMs / 1000).toFixed(2)}s`);
  console.log(`  requests: ${results.length}   ok: ${ok}   failed: ${fail}`);
  console.log(`  throughput: ${(ok / (totalMs / 1000)).toFixed(0)} ok-req/s`);
  console.log(`  latency ms: avg=${avg} p50=${pct(50)} p95=${pct(95)} p99=${pct(99)} max=${(lat[lat.length - 1] ?? 0).toFixed(0)}`);
  console.log(`  status codes:`, byStatus);
  const errs = [...new Set(results.filter((r) => r.error).map((r) => r.error))].slice(0, 5);
  if (errs.length) console.log(`  sample errors:`, errs);

  if (SCENARIO === "checkin") {
    const tokens = results.map((r) => r.token).filter(Boolean);
    const seen = new Set();
    const dups = new Set();
    for (const t of tokens) (seen.has(t) ? dups : seen).add(t);
    console.log(`  tokens generated: ${tokens.length}   unique: ${seen.size}   duplicates: ${dups.size}`);
    if (dups.size) console.log(`  WARNING duplicate tokens (race in getNextTokenNo):`, [...dups].slice(0, 10));
  }
  process.exit(0);
}

main();
