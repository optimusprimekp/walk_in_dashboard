# Walk-In Interview Manager

A walk-in interview / candidate check-in dashboard, split into a React client and a Node (Express) API server.

```
walk_in_dashboard/
├── client/        # React + Vite frontend
│   └── src/
│       ├── api/         # API client (react-query hooks + fetch wrapper + types)
│       ├── components/  # UI components (shadcn/ui)
│       ├── hooks/
│       ├── lib/
│       └── pages/       # admin, hr, interviewer, checkin, tv, login
└── server/        # Express API + Drizzle ORM (PostgreSQL)
    ├── drizzle.config.ts
    └── src/
        ├── api-zod/     # shared zod schemas / response types
        ├── db/          # drizzle connection + schema
        ├── lib/
        ├── routes/      # /api/* route handlers
        ├── app.ts
        └── index.ts
```

## Prerequisites

- Node.js 18+
- A PostgreSQL database (set `DATABASE_URL`)

## Setup

Install dependencies for both apps:

```bash
npm run install:all
```

Create `server/.env` with your database connection:

```
DATABASE_URL=postgres://user:password@localhost:5432/walk_in
# PORT=3001        # optional, defaults to 3001
```

Push the schema to the database:

```bash
npm run db:push
```

## Development

Run the client and server together (client on http://localhost:5173, server on http://localhost:3001):

```bash
npm run dev
```

The Vite dev server proxies `/api` requests to the Express server, so no CORS or base-URL configuration is needed. You can also run them separately with `npm run dev:client` and `npm run dev:server`.

## Production

Build the client, then start the server (it serves the built client from `client/dist` and the `/api` routes from the same origin):

```bash
npm run build
npm start
```

## Useful scripts (root)

| Script | Description |
| --- | --- |
| `npm run install:all` | Install deps for client and server |
| `npm run dev` | Run client + server together |
| `npm run build` | Build the client |
| `npm start` | Start the API server (serves built client too) |
| `npm run typecheck` | Type-check both apps |
| `npm run db:push` | Push the Drizzle schema to the database |
