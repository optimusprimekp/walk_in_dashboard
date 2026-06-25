import "./load-env";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureTokenSequence } from "./routes/tokens";

const port = Number(process.env.PORT ?? 3001);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Make sure the token-number sequence exists (concurrency-safe tokens).
  ensureTokenSequence().catch((e) => logger.error({ err: e }, "Failed to ensure token sequence"));
});
