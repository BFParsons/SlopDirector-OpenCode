#!/usr/bin/env node
/*
 * Generate prisma/desktop-schema.sql — the CREATE TABLE/INDEX DDL the desktop
 * build executes on first launch to create the embedded SQLite database (see
 * src/lib/db/bootstrap.ts).
 *
 * Built from `prisma migrate diff --from-empty`, with one fix-up: Prisma emits
 * JSON column defaults UNQUOTED (`DEFAULT {}`), which SQLite rejects — they must
 * be string literals (`DEFAULT '{}'`).
 *
 * Run: `pnpm db:sqlite:ddl`  (after `pnpm db:sqlite:derive`)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let sql = execSync(
  "pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.sqlite.prisma --script",
  { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "file:./.data/_ddlgen.db" } },
);

// SQLite needs JSON/object defaults quoted as string literals.
sql = sql.replace(/DEFAULT \{\}/g, "DEFAULT '{}'").replace(/DEFAULT \[\]/g, "DEFAULT '[]'");

const dest = join(root, "prisma", "desktop-schema.sql");
writeFileSync(dest, sql);
console.log(`Wrote ${dest}`);
