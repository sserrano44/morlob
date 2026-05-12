import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const env = {};
  const content = readFileSync(path, "utf8");

  for (const rawLine of content.split(/\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");

    if (index < 0) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const localEnv = loadEnvFile(".env.local");
const databaseUrl =
  process.env.DATABASE_URL ||
  localEnv.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  localEnv.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required. SUPABASE_DB_URL is accepted as a legacy fallback.");
  process.exit(1);
}

const migrationsDir = "supabase/migrations";
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

function runPsql(args, options = {}) {
  const result = spawnSync("psql", [databaseUrl, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  process.stderr.write(result.stderr.replaceAll(databaseUrl, "[redacted]"));

  if (result.status !== 0) {
    process.stdout.write(result.stdout.replaceAll(databaseUrl, "[redacted]"));
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

runPsql([
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "create table if not exists public.morlob_schema_migrations (version text primary key, applied_at timestamptz not null default now());"
]);

const applied = new Set(
  runPsql(["-At", "-c", "select version from public.morlob_schema_migrations;"])
    .split(/\n/)
    .map((value) => value.trim())
    .filter(Boolean)
);

function migrationAlreadyApplied(version) {
  if (applied.has(version)) {
    return true;
  }

  if (version === "001_core_todos_files.sql") {
    const exists = runPsql([
      "-At",
      "-c",
      "select to_regclass('public.organizations') is not null and to_regclass('public.workspaces') is not null and to_regclass('public.todos') is not null and to_regclass('public.files') is not null;"
    ]).trim();

    if (exists === "t") {
      runPsql([
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `insert into public.morlob_schema_migrations (version) values ('${version}') on conflict do nothing;`
      ]);
      applied.add(version);
      return true;
    }
  }

  return false;
}

for (const migration of migrations) {
  if (migrationAlreadyApplied(migration)) {
    console.log(`Skipping ${migration}`);
    continue;
  }

  const filePath = join(migrationsDir, migration);
  console.log(`Applying ${filePath}`);

  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", filePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  process.stdout.write(result.stdout.replaceAll(databaseUrl, "[redacted]"));
  process.stderr.write(result.stderr.replaceAll(databaseUrl, "[redacted]"));

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  runPsql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `insert into public.morlob_schema_migrations (version) values ('${migration}') on conflict do nothing;`
  ]);
}
