// Loads server/.env and makes it authoritative: `override: true` ensures the
// values in .env win over any stale/inherited environment variables (e.g. a
// DATABASE_URL left in the PM2 daemon's environment from an earlier start).
// Import this as the FIRST import in every entrypoint, before anything that
// reads process.env (db connection, drizzle config, etc.).
import dotenv from "dotenv";

dotenv.config({ override: true });
