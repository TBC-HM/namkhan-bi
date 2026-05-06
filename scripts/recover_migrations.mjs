#!/usr/bin/env node
// scripts/recover_migrations.mjs
// Parse supabase db dump output (INSERT statements with text[] columns) and
// write each migration as a .sql file. Skips files already on disk.
//
// Usage:
//   1. supabase db dump --linked --data-only --schema supabase_migrations -f /tmp/migrations_dump.sql
//   2. node scripts/recover_migrations.mjs

import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const MIG_DIR = resolve(REPO_ROOT, "supabase/migrations");
const DUMP_FILE = "/tmp/migrations_dump.sql";

if (!existsSync(DUMP_FILE)) {
  console.error("FATAL: dump not found at", DUMP_FILE);
  console.error("Run: supabase db dump --linked --data-only --schema supabase_migrations -f /tmp/migrations_dump.sql");
  process.exit(1);
}

const existing = new Set(
  readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.match(/^(\d+)_/)?.[1])
    .filter(Boolean)
);
console.log(`Found ${existing.size} existing migration files on disk — will skip.`);

const dump = readFileSync(DUMP_FILE, "utf8");

import arrayParser from "postgres-array";

// Extract VALUES rows: lines like `\t('20260426...', '{...}', 'name', NULL, NULL, NULL),`
// or starting with `INSERT INTO ... VALUES`.
const rows = [];

// Strategy: find the INSERT block, then walk through it row by row using
// a careful tokenizer that respects single-quote escaping and array brace nesting.
const insertStart = dump.indexOf('INSERT INTO "supabase_migrations"."schema_migrations"');
if (insertStart === -1) {
  console.error("FATAL: no INSERT block found in dump");
  process.exit(1);
}
const valuesStart = dump.indexOf("VALUES", insertStart) + "VALUES".length;
// Slice from VALUES to end-of-statement (semicolon at start of new line)
const block = dump.slice(valuesStart);

// Walk the block character-by-character, parsing ('val', 'val', 'val', ...)
let i = 0;
function skipWs() {
  while (i < block.length && /\s/.test(block[i])) i++;
}
function parseValue() {
  // Either NULL, or '...' SQL-quoted string.
  if (block.slice(i, i + 4).toUpperCase() === "NULL") {
    i += 4;
    return null;
  }
  if (block[i] !== "'") throw new Error(`Expected ' or NULL at ${i}: ${block.slice(i, i+30)}`);
  i++;
  let out = "";
  while (i < block.length) {
    const c = block[i];
    if (c === "'") {
      // Doubled quote = escaped single quote
      if (block[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      i++;
      return out;
    }
    out += c;
    i++;
  }
  throw new Error("Unterminated string");
}

while (i < block.length) {
  skipWs();
  if (block[i] === ";") break;
  if (block[i] !== "(") {
    if (block[i] === ",") { i++; continue; }
    if (i >= block.length - 5) break;
    throw new Error(`Expected ( at ${i}: ${block.slice(i, i+30)}`);
  }
  i++; // consume (
  skipWs();
  const version = parseValue();
  skipWs(); if (block[i] === ",") i++; skipWs();
  const statementsRaw = parseValue();
  skipWs(); if (block[i] === ",") i++; skipWs();
  const name = parseValue();
  skipWs(); if (block[i] === ",") i++; skipWs();
  /* created_by */ parseValue();
  skipWs(); if (block[i] === ",") i++; skipWs();
  /* idempotency_key */ parseValue();
  skipWs(); if (block[i] === ",") i++; skipWs();
  /* rollback */ parseValue();
  skipWs();
  if (block[i] !== ")") throw new Error(`Expected ) at ${i}: ${block.slice(i, i+30)}`);
  i++;
  rows.push({ version, statementsRaw, name });
}

console.log(`Parsed ${rows.length} migrations from dump.`);

let written = 0;
let skipped = 0;
let errors = 0;

const HEADER = (version, name) =>
  `-- Recovered from supabase_migrations.schema_migrations on ${new Date().toISOString().slice(0, 10)}.\n` +
  `-- Version: ${version}\n` +
  `-- Name:    ${name ?? "unnamed"}\n` +
  `-- Source:  prod kpenyneooigsyuuomgct (canonical)\n` +
  `-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split\n` +
  `\n`;

for (const row of rows) {
  if (existing.has(row.version)) {
    skipped++;
    continue;
  }
  try {
    const stmts = arrayParser.parse(row.statementsRaw, (x) => x);
    const body = stmts.join("\n\n");
    const safe = (row.name || "unnamed").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
    const filename = `${row.version}_${safe}.sql`;
    const path = resolve(MIG_DIR, filename);
    writeFileSync(path, HEADER(row.version, row.name) + body);
    written++;
    if (written % 50 === 0) console.log(`  ${written} written...`);
  } catch (e) {
    console.error(`FAIL ${row.version} (${row.name}): ${e.message}`);
    errors++;
  }
}

console.log("");
console.log("===");
console.log(`Written: ${written}`);
console.log(`Skipped (already on disk): ${skipped}`);
console.log(`Errors: ${errors}`);
console.log(`Total now in supabase/migrations/: ${readdirSync(MIG_DIR).filter(f=>f.endsWith('.sql')).length}`);
