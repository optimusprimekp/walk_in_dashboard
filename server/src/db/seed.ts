import "../load-env";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "./index";

// Mirrors hashPassword() in routes/auth.ts — keep the salt in sync.
function hashPassword(password: string): string {
  return createHash("sha256")
    .update(password + "interview_salt_2024")
    .digest("hex");
}

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? "Admin@kp2026";
const name = process.env.ADMIN_NAME ?? "Administrator";

async function main() {
  const passwordHash = hashPassword(password);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existing) {
    await db
      .update(usersTable)
      .set({ passwordHash, role: "ADMIN", name })
      .where(eq(usersTable.id, existing.id));
    console.log(`Updated admin user "${username}".`);
  } else {
    await db
      .insert(usersTable)
      .values({ username, passwordHash, name, role: "ADMIN" });
    console.log(`Created admin user "${username}".`);
  }

  console.log(`Login with username "${username}" and the configured password.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
