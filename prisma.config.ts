import { defineConfig } from "prisma/config";
import { loadEnvFiles } from "./config/load-env";

/**
 * Configuration for the Prisma CLI.
 *
 * Prisma 7 reads its configuration from this file rather than from
 * `package.json` or the schema's `datasource` block, and it no longer loads
 * `.env` files on its own. `loadEnvFiles()` restores that behaviour with the
 * same precedence Next.js uses, so `pnpm db:migrate` and `next dev` resolve
 * identical values from `.env.local` / `.env`.
 *
 * This file is executed by the Prisma CLI, never by the application: `process`
 * is read directly here because the CLI needs the raw string before the
 * application's Zod schema (config/env.ts) has had a chance to run. The lint
 * exemption is scoped to this file and documented in eslint.config.mjs.
 */
loadEnvFiles();

/**
 * Migrations run over the direct connection with the privileged role that may
 * create extensions and constraints; the application runs over the pooled
 * connection with a DML-only role (ARCHITECTURE.md §8.1, §26, §28).
 *
 * `DATABASE_URL` is the fallback for single-connection environments. Commands
 * that need a database (`migrate`, `db seed`) report a connection error when
 * neither variable is set; `generate`, `format`, and `validate` need no
 * database at all.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 triggers seeding only through `prisma db seed`.
    seed: "tsx db/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
