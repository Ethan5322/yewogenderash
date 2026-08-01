/**
 * Fails if prisma/schema.prisma declares a table or column that no SQL
 * migration creates. Needs no database, so it can run in CI on every push.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT check-schema-drift.mjs
 *   That script asks "is the LIVE database up to date?" — it connects and checks
 *   a hand-written EXPECTED list. Useful before a deploy, but it needs
 *   credentials, and the list is maintained by hand, which is exactly how the
 *   2026-07-29 drift survived: isSuperAdmin and adminPermissions were read on
 *   every admin request, declared in schema.prisma, created by no migration, and
 *   missing from that list, so nothing flagged them. Production worked only
 *   because someone had added the columns in the Supabase console by hand.
 *
 *   This script derives what to expect FROM THE SCHEMA, so a new model or field
 *   is covered the moment it is written and nobody has to maintain a list.
 *
 * KNOWN LIMIT: compares names, not types. A column declared Int and created as
 * TEXT passes here. Catching that needs a real database; catching a MISSING
 * column — the failure that actually happened — does not.
 *
 * Usage: node scripts/check-migration-parity.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

/** Prisma scalars. Anything else is an enum (a column) or a model (not one). */
const SCALARS = new Set([
  "String", "Boolean", "Int", "BigInt", "Float", "Decimal",
  "DateTime", "Json", "Bytes",
]);

const modelNames = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
const enumNames = [...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]);

/** schema.prisma → { table: Set(columns) }, honouring @@map and @map. */
function expectedTables() {
  const tables = {};
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(schema))) {
    const [, name, body] = m;
    const mapped = /@@map\("([^"]+)"\)/.exec(body);
    const table = mapped ? mapped[1] : name;
    const cols = new Set();

    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      const f = /^(\w+)\s+(\w+)(\?)?(\[\])?/.exec(line);
      if (!f) continue;
      const [, field, type, , list] = f;
      if (list) continue; // list side of a relation, never a column
      if (modelNames.includes(type)) continue; // relation field, not a column
      if (!SCALARS.has(type) && !enumNames.includes(type)) continue;

      const colMap = /@map\("([^"]+)"\)/.exec(line);
      cols.add(colMap ? colMap[1] : field);
    }
    tables[table] = cols;
  }
  return tables;
}

/*
 * Identifiers in these migrations are inconsistently quoted: `ALTER TABLE
 * yd_users` in one file, `ALTER TABLE "yd_payouts"` in another, and lowercase
 * columns are usually bare while camelCase ones must be quoted. Every pattern
 * below therefore treats the quotes as optional — an earlier version matched
 * only the quoted form and reported five columns as missing that were present
 * all along.
 */
const CREATE_TABLE = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_]\w*)"?\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
const COLUMN_LINE = /^\s*"?([A-Za-z_]\w*)"?\s+\S/;
const CONSTRAINT_LINE = /^\s*(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)\b/i;
const ALTER_TABLE = /ALTER TABLE\s+"?([A-Za-z_]\w*)"?([\s\S]*?);/gi;
const ADD_COLUMN = /ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_]\w*)"?/gi;
const DROP_COLUMN = /DROP COLUMN(?:\s+IF EXISTS)?\s+"?([A-Za-z_]\w*)"?/gi;
const RENAME_COLUMN = /RENAME COLUMN\s+"?([A-Za-z_]\w*)"?\s+TO\s+"?([A-Za-z_]\w*)"?/gi;

/** Migrations → { table: Set(columns) }, replaying creates, adds, drops, renames. */
function actualTables() {
  const dir = join(root, "supabase", "migrations");
  // The same filter local-db.mjs uses, so both scripts read one set of files.
  // It excludes the combined paste-into-supabase bundles, which only re-apply
  // migrations already in the list.
  const files = readdirSync(dir).filter((f) => /^\d{4}_yd_.*\.sql$/.test(f)).sort();
  const tables = {};

  for (const file of files) {
    // Comments are stripped so a column name mentioned in prose is never
    // mistaken for a column that exists.
    const sql = readFileSync(join(dir, file), "utf8")
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    for (const t of sql.matchAll(CREATE_TABLE)) {
      const [, table, body] = t;
      tables[table] ??= new Set();
      for (const line of body.split("\n")) {
        if (CONSTRAINT_LINE.test(line)) continue;
        const c = COLUMN_LINE.exec(line);
        if (c) tables[table].add(c[1]);
      }
    }

    for (const a of sql.matchAll(ALTER_TABLE)) {
      const [, table, body] = a;
      tables[table] ??= new Set();
      for (const x of body.matchAll(ADD_COLUMN)) tables[table].add(x[1]);
      for (const x of body.matchAll(DROP_COLUMN)) tables[table].delete(x[1]);
      for (const x of body.matchAll(RENAME_COLUMN)) {
        tables[table].delete(x[1]);
        tables[table].add(x[2]);
      }
    }
  }
  return tables;
}

/**
 * schema.prisma → { enumType: Set(values) }, honouring @@map.
 *
 * Added after a third drift got through: OtpPurpose declared LOGIN_2FA, which
 * auth.ts requires for admin 2FA, and NO migration added it — 0001 created the
 * type with three values. The live database had it by hand; a rebuilt one failed
 * at runtime with "invalid input value for enum yd_otp_purpose". Comparing tables
 * and columns was never going to catch that.
 */
function expectedEnums() {
  const out = {};
  const re = /^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(schema))) {
    const [, name, body] = m;
    const mapped = /@@map\("([^"]+)"\)/.exec(body);
    const type = mapped ? mapped[1] : name;
    const values = new Set();
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      if (/^[A-Z][A-Z0-9_]*$/.test(line)) values.add(line);
    }
    out[type] = values;
  }
  return out;
}

/** Migrations → { enumType: Set(values) }, from CREATE TYPE and ALTER TYPE. */
function actualEnums() {
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => /^\d{4}_yd_.*\.sql$/.test(f)).sort();
  const out = {};

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8")
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    for (const t of sql.matchAll(
      /CREATE TYPE\s+"?([A-Za-z_]\w*)"?\s+AS ENUM\s*\(([\s\S]*?)\)\s*;/gi
    )) {
      const [, type, body] = t;
      out[type] ??= new Set();
      for (const v of body.matchAll(/'([^']+)'/g)) out[type].add(v[1]);
    }
    for (const a of sql.matchAll(
      /ALTER TYPE\s+"?([A-Za-z_]\w*)"?\s+ADD VALUE(?:\s+IF NOT EXISTS)?\s+'([^']+)'/gi
    )) {
      out[a[1]] ??= new Set();
      out[a[1]].add(a[2]);
    }
  }
  return out;
}

const expected = expectedTables();
const actual = actualTables();
const expectedEnumValues = expectedEnums();
const actualEnumValues = actualEnums();

const problems = [];

for (const [type, values] of Object.entries(expectedEnumValues)) {
  if (!actualEnumValues[type]) {
    problems.push(`enum "${type}" is declared in schema.prisma but no migration creates it`);
    continue;
  }
  const missing = [...values].filter((v) => !actualEnumValues[type].has(v));
  if (missing.length) {
    problems.push(`enum "${type}" is missing value(s) in migrations: ${missing.join(", ")}`);
  }
}
for (const [table, cols] of Object.entries(expected)) {
  if (!actual[table]) {
    problems.push(`table "${table}" is declared in schema.prisma but no migration creates it`);
    continue;
  }
  const missing = [...cols].filter((c) => !actual[table].has(c));
  if (missing.length) {
    problems.push(`"${table}" is missing column(s) in migrations: ${missing.join(", ")}`);
  }
}

if (problems.length) {
  console.error("SCHEMA DRIFT — schema.prisma declares what the migrations do not create:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nAdd a migration under supabase/migrations/ for each one.\n" +
      "A column that exists only in schema.prisma works on the live database\n" +
      "(because someone added it by hand) and breaks every rebuild.\n"
  );
  process.exit(1);
}

const tableCount = Object.keys(expected).length;
const colCount = Object.values(expected).reduce((n, s) => n + s.size, 0);
const enumCount = Object.keys(expectedEnumValues).length;
const valueCount = Object.values(expectedEnumValues).reduce((n, s) => n + s.size, 0);
console.log(
  `Schema and migrations agree — ${tableCount} tables, ${colCount} columns, ` +
    `${enumCount} enums, ${valueCount} enum values.`
);
