// lib/data/sqlGuard.ts
// Tight allowlist filter for AI-generated SQL.
// Block all DDL/DML, only allow a single SELECT (or WITH … SELECT).

const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create',
  'grant', 'revoke', 'copy', 'vacuum', 'analyze', 'reindex', 'cluster',
  'reset', 'set ', 'do ', 'lock ', 'comment on', 'execute ', 'call ',
  'pg_sleep', 'pg_read_file', 'pg_ls_dir', 'lo_export', 'lo_import',
  'security definer', '\\;',
];

export type GuardResult = { ok: true; sql: string } | { ok: false; reason: string };

export function guardSql(raw: string): GuardResult {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty SQL' };
  let sql = raw.trim();

  // Strip code fences if AI added them
  sql = sql.replace(/^```(?:sql)?\s*/i, '').replace(/```$/, '').trim();

  // Strip trailing semicolons
  sql = sql.replace(/;+\s*$/g, '');

  // Reject multi-statement
  if (sql.includes(';')) return { ok: false, reason: 'multiple statements not allowed' };

  // Must start with SELECT or WITH
  if (!/^(select|with)\b/i.test(sql)) return { ok: false, reason: 'must start with SELECT or WITH' };

  // Forbidden keywords (case-insensitive, word-boundary)
  const lower = sql.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw.trim()}\\b`, 'i');
    if (re.test(' ' + lower + ' ')) {
      return { ok: false, reason: `forbidden keyword: ${kw.trim()}` };
    }
  }

  // Force a LIMIT if missing — cap at 200 rows
  if (!/\blimit\s+\d+/i.test(sql)) {
    sql = sql + ' LIMIT 200';
  } else {
    // If LIMIT is too high, clamp it
    sql = sql.replace(/\blimit\s+(\d+)/i, (_, n) =>
      Number(n) > 500 ? 'LIMIT 500' : `LIMIT ${n}`,
    );
  }

  return { ok: true, sql };
}
