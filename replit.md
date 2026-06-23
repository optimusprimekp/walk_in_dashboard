# Walk-In Interview Management System

A Passport Seva Kendra-style enterprise token management platform for corporate walk-in interview days — handling QR check-in, token generation, queue management, interviewer dashboards, and a real-time TV display.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/interview-manager run dev` — run the frontend (port 21684)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Default Login Credentials

| Username | Password | Role |
|---|---|---|
| admin | admin123 | ADMIN |
| hr | hr123 | HR |
| interviewer1 | int123 | INTERVIEWER |
| interviewer2 | int123 | INTERVIEWER |
| reception | rec123 | RECEPTION |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Shadcn UI + Wouter + TanStack React Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM table definitions (candidates, tokens, tables, sessions, announcements, users)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, candidates, tokens, tables, sessions, dashboard, queue)
- `artifacts/interview-manager/src/` — React frontend (pages: login, dashboard, tv, checkin, interviewer, candidates, tables)

## Architecture decisions

- Auth is a simple base64-encoded token with sha256 password hash + salt — suitable for internal enterprise use, not public-facing.
- Token numbering resets daily (T001–T999), based on count of tokens created since midnight.
- Auto-assignment runs after every check-in and session end — picks oldest WAITING token and first AVAILABLE table.
- TV display (/tv) and QR check-in (/checkin) are public routes — no auth required.
- Queue assignment logic lives in `artifacts/api-server/src/routes/queue.ts` — shared between candidates and sessions routes.

## Product

- **Admin Dashboard** — real-time stats, hourly charts, position breakdown, table status grid
- **TV Display** — full-screen waiting area display, polls every 5s, shows NOW CALLING + queue table
- **QR Check-In Kiosk** — touch-friendly pre-registered lookup or walk-in registration, ends with large token confirmation
- **Interviewer Dashboard** — assigned candidate card, START/END/REJECT/SELECT/HOLD buttons, 20-minute countdown timer
- **Candidate List (HR)** — filterable/searchable table, Excel import with preview
- **Table Management (Admin)** — CRUD for interview tables and interviewer assignments

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after any spec change before editing frontend.
- Auth token is stored in `localStorage` key `"auth_token"` on the frontend.
- The queue auto-assignment fires asynchronously (non-blocking) after check-in and session end.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
