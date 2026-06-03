/**
 * Create (or reset) an account from the CLI — the secure way to bootstrap the
 * first admin with no public /register exposure. Doubles as a password reset.
 *
 *   Local:     pnpm tsx --env-file=.env scripts/create-admin.ts you@example.com 'pw' ADMIN
 *   Container: docker compose exec app pnpm create-admin you@example.com 'pw'
 *
 * Self-contained (only @prisma/client + @node-rs/argon2, no @/ alias) so it runs
 * inside the production image where the TS source/tsconfig aren't shipped.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

// OWASP argon2id params — mirror src/lib/auth/password.ts.
const ARGON2 = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "";
  const role = (process.argv[4] ?? "ADMIN").toUpperCase() === "USER" ? "USER" : "ADMIN";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Usage: create-admin <email> <password> [USER|ADMIN]");
    console.error("   (or set ADMIN_EMAIL / ADMIN_PASSWORD)");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hash(password, ARGON2);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, role },
      update: { passwordHash, role },
    });
    console.log(`OK: ${user.email} is now ${user.role} (password set).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("create-admin failed:", e);
  process.exit(1);
});
