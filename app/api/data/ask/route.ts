// app/api/data/ask/route.ts
// POST /api/data/ask
// ----------------------------------------------------------------------------
// Data Q/A — answers questions like:
//   "show me budget variance January for F&B"
//   "food suppliers january"
//   "what's our ADR last month"
//   "which contracts expire in the next 90 days"
//
// Flow:
//   1. Send question + curated schema catalog to Claude Sonnet → SQL
//   2. SELECT-only guard, force LIMIT
//   3. Execute via service-role admin (RLS bypassed for read)
//   4. Send results back to Claude Sonnet for a 1-paragraph natural-language answer
//   5. Return {answer, sql, rows, columns} so UI can render table + summary
// ----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SCHEMA_CATALOG } from '@/lib/data/schemaCatalog';
import { guardSql } from '@/lib/data/sqlGuard';
import { loadShared, loadPrompt } from '@/lib/prompts';

// Loaded once at module init
const CROSS_SCHEMA_GUIDE = (() => {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), 'prompts/data-agent/cross-schema-search.md'),
      'utf-8'
    );
  } catch { return ''; }
})();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SQL_GEN_SYSTEM = `You are a SQL agent for a hotel BI portal (Postgres 17, Supabase).
Given a question and a schema catalog, return a SINGLE valid Postgres SELECT statement.

Rules:
- Output ONLY the SQL. No commentary, no markdown fences.
- SELECT only. No DDL/DML.
- Always qualify table names with their schema (e.g. gl.v_budget_lines).
- Always include a LIMIT (default 50, max 500).
- Use only the views/tables in the catalog. Do not invent table or column names.
- For "current month" / "this year" / "now" — use current_date.
- Prefer USD columns over LAK when both exist.
- For F&B / dietary words / "food", check both account_name and dept columns.
- For dates: months are 1-12. Use date_trunc('month', ...) for month windows.
- If the question is ambiguous, make a reasonable assumption (e.g. "this year" = current year).
- If the question can't be answered from the catalog, return: SELECT 'NO_VIEW' AS answer LIMIT 1;

★ FINANCE / P&L QUERIES — extra rules:
- For ANY P&L-style question ("p/l", "p&l", "pnl", "income statement", "profit and loss",
  "expenses january", "where is money going"), DO NOT dump 90 raw rows.
- IF the user wants a DEPARTMENT-LEVEL view ("by dept", "P&L by department", "F&B vs Rooms"):
    use gl.v_usali_dept_summary — pivots are baked-in per dept.
    SELECT usali_department, revenue, cost_of_sales, payroll, other_op_exp,
           departmental_profit, dept_profit_margin
    FROM gl.v_usali_dept_summary
    WHERE period_yyyymm = '2026-01'
    ORDER BY CASE usali_department
      WHEN 'Rooms'           THEN 1
      WHEN 'F&B'             THEN 2
      WHEN 'Spa'             THEN 3
      WHEN 'Activities'      THEN 4
      WHEN 'Mekong Cruise'   THEN 5
      WHEN 'Other Operated'  THEN 6
      WHEN 'Undistributed'   THEN 7
      ELSE 99 END LIMIT 20;
- For SUMMARY P&L (no dept split, just hierarchy by section):
  Roll up by usali_subcategory, sort in canonical USALI order, return ~10-15 rows max:

    SELECT
      usali_subcategory,
      SUM(amount_usd) AS amount_usd,
      COUNT(*)        AS line_count
    FROM gl.v_pl_monthly_usali
    WHERE period_yyyymm = '2026-01'
    GROUP BY usali_subcategory
    ORDER BY CASE usali_subcategory
      WHEN 'Revenue'                 THEN 1
      WHEN 'Cost of Sales'           THEN 2
      WHEN 'Payroll & Related'       THEN 3
      WHEN 'Other Operating Expenses' THEN 4
      WHEN 'A&G'                     THEN 5
      WHEN 'Sales & Marketing'       THEN 6
      WHEN 'POM'                     THEN 7
      WHEN 'Utilities'               THEN 8
      WHEN 'Mgmt Fees'               THEN 9
      WHEN 'Depreciation'            THEN 10
      WHEN 'Interest'                THEN 11
      WHEN 'FX Gain/Loss'            THEN 12
      WHEN 'Non-Operating'           THEN 13
      WHEN 'Income Tax'              THEN 14
      ELSE 99
    END LIMIT 30;

- Only return account-level detail (90+ rows) when user explicitly asks for "by account"
  or "show all line items" or "drill down".
- For variance / vs budget questions, use gl.v_budget_vs_actual which has actual + budget
  + variance pre-computed; keep the same sort order.`;

const ANSWER_SYSTEM = `You explain query results in plain English.
Given a question, the SQL, and the result rows, write a concise structured answer.

GENERAL RULES:
- 0 rows → say so plainly, suggest why.
- 1 row → state the value directly with the metric name.
- Match the language of the question.
- Don't reproduce the SQL or full table — just the human takeaway.
- ALWAYS include the period the data covers (month/year).
- NEVER use unordered bullet lists for numeric breakdowns. They're hard to scan.
- Prefer SHORT prose + a small Markdown table when listing items with values.
- Currencies: render with thousands separators (e.g. $12,345 not $12345).
- Convert big numbers ≥ $10k to short form ($12.3k, $1.4M) inside prose; keep full digits in tables.

★ FINANCE / P&L SPECIFIC (mandatory for any answer touching gl.v_pl_monthly_usali,
  gl.v_budget_vs_actual, gl.v_pnl_usali, payroll, or any USALI subcategory):

  Format the answer as a USALI hierarchy in a Markdown table with EXACT section order:

    | USALI Section            | Amount    |
    |--------------------------|-----------|
    | **Revenue**              | $X        |
    |    Rooms                 |   $a      |
    |    F&B (Food + Bev)      |   $b      |
    |    Spa / Activities      |   $c      |
    |    Other ancillary       |   $d      |
    | **Cost of Sales**        | ($X)      |
    | **Payroll & Related**    | ($X)      |
    | **Other Operating Exp.** | ($X)      |
    | **= Department GOP**     | $X        |
    | **Undistributed**        | ($X)      |
    |    A&G                   |   ($a)    |
    |    Sales & Marketing     |   ($b)    |
    |    POM                   |   ($c)    |
    |    Utilities             |   ($d)    |
    | **= GOP**                | $X        |
    | Mgmt Fees                | ($X)      |
    | Non-operating            | ($X)      |
    | **= Net Income**         | $X        |

  Rules for the USALI table:
  - Negative numbers / costs in parentheses: ($1,234).
  - Bold the totals (Revenue, Cost of Sales, Payroll, OpEx, Dept GOP, Undistributed, GOP, Net Income).
  - Indent sub-lines with non-breaking spaces or just leading spaces.
  - Skip rows that are exactly $0 — keep the table compact.
  - If data covers only one department (e.g. "F&B variance"), keep the same hierarchy but
    only the rows that apply (Revenue, Cost of Sales, Payroll, Other OpEx, Dept GOP).
  - After the table, write 1 short sentence flagging the biggest variance / driver.

★ NON-FINANCE QUERIES (suppliers, KPIs, occupancy, etc.):
  - 1 row → prose ("Last month ADR was $203.20").
  - 2-10 rows → small Markdown table (3-4 cols max).
  - Many rows → table with top-N + a one-line total.`;

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { question?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const question = (body.question || '').trim();
  if (question.length < 3) return NextResponse.json({ ok: false, error: 'question_too_short' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  // Today's date — pass to BOTH SQL gen and answer synthesis so the AI doesn't
  // hallucinate years (it's been guessing 2024/2025 instead of current year).
  const today = new Date().toISOString().slice(0, 10);

  // Caller role (Stage F) — passed via X-User-Role header. Defaults to 'owner'
  // since portal is currently single-user PBS-mode. When SSO ships this comes
  // from the JWT 'role' claim instead.
  const callerRole = (req.headers.get('x-user-role') || 'owner').toLowerCase();

  // Load shared rules (DB override → fs fallback). 60s cache.
  const shared = await loadShared();
  const crossSchemaGuide = await loadPrompt('data-agent/cross-schema-search.md') || CROSS_SCHEMA_GUIDE;

  // Compose shared rules into the system prompts
  const SQL_SYSTEM_FULL = [
    SQL_GEN_SYSTEM,
    `\n---\n## Caller role: ${callerRole}`,
    `(Filter the query to data this role is allowed to see — see access policy below.)`,
    '\n## Version policy (shared)',
    shared.version_policy,
    '\n## Access policy (shared)',
    shared.access_policy,
    '\n## Cross-schema search guidance',
    crossSchemaGuide,
  ].join('\n');

  const ANSWER_SYSTEM_FULL = [
    ANSWER_SYSTEM,
    `\n---\n## Caller role: ${callerRole}`,
    '\n## Output style (shared)',
    shared.output_style,
    '\n## Version policy (shared) — cite versions in source line',
    shared.version_policy,
  ].join('\n');

  // --- 1. SQL generation
  const sqlGenResp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.0,
      system: SQL_SYSTEM_FULL,
      messages: [{
        role: 'user',
        content:
          `TODAY'S DATE: ${today}\n` +
          `(use this to resolve "this year"/"this month"/"last month"/"January" etc.)\n\n` +
          `SCHEMA CATALOG:\n${SCHEMA_CATALOG}\n\nQUESTION: ${question}\n\nReturn the SQL only.`,
      }],
    }),
  });
  if (!sqlGenResp.ok) {
    const err = await sqlGenResp.text();
    return NextResponse.json({ ok: false, stage: 'sql_gen', error: `Anthropic ${sqlGenResp.status}: ${err.slice(0,200)}` }, { status: 500 });
  }
  const sqlGenData = await sqlGenResp.json() as { content: { type: string; text: string }[] };
  const rawSql = sqlGenData.content.find(c => c.type === 'text')?.text ?? '';

  // --- 2. Guard
  const guard = guardSql(rawSql);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, stage: 'guard', error: (guard as { ok: false; reason: string }).reason, generated_sql: rawSql }, { status: 400 });
  }
  const sql = (guard as { ok: true; sql: string }).sql;

  // Special-case the "no view" sentinel
  if (/^select\s+'NO_VIEW'/i.test(sql)) {
    return NextResponse.json({
      ok: true,
      answer: "I don't have a data view for that. Try a doc question (e.g. 'what does Hilton say about reporting'), or rephrase using budget/suppliers/inventory/ADR/occupancy/contracts.",
      sql,
      rows: [],
      columns: [],
      row_count: 0,
    });
  }

  // --- 3. Execute via a SECURITY-DEFINER RPC. If exec fails with
  //       column/relation-not-exist, introspect actual schema + retry once.
  let rows: any[] = [];
  let columns: string[] = [];
  let execError: string | null = null;
  let usedSql = sql;
  let retried = false;

  const tryExec = async (sqlToRun: string) => {
    try {
      const { data, error } = await admin.rpc('docs_data_query', { sql_text: sqlToRun });
      if (error) return { ok: false, msg: error.message };
      return { ok: true, data: (data || []) as any[] };
    } catch (e: any) {
      return { ok: false, msg: e?.message ?? 'exec failed' };
    }
  };

  let result = await tryExec(sql);
  if (result.ok) {
    rows = result.data!;
    columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  } else {
    execError = result.msg!;
    // SCHEMA RETRY: if the error is about a missing column/table, introspect
    // the offending view and ask the SQL agent to fix it once.
    const colMatch = /column "([^"]+)" does not exist/.exec(execError);
    const tableMatch = /relation "([^"]+)" does not exist/.exec(execError);
    if (colMatch || tableMatch) {
      // Extract schema-qualified table refs from the SQL (e.g. gl.v_pl_monthly_usali)
      const tableRefs = Array.from(
        new Set(sql.match(/[a-z][a-z_0-9]*\.[a-z_][a-z_0-9]*/gi) || [])
      ).filter(ref => /^(gl|inv|kpi|suppliers|proc|marketing|docs|news|ops|public)\./.test(ref));

      let introspect = '';
      for (const ref of tableRefs.slice(0, 4)) {
        const [schema, table] = ref.split('.');
        try {
          const { data: cols } = await admin.rpc('docs_data_query', {
            sql_text:
              `SELECT column_name, data_type FROM information_schema.columns ` +
              `WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`,
          });
          if (cols && cols.length > 0) {
            introspect += `\n${ref} columns: ${(cols as any[]).map(c => `${c.column_name}:${c.data_type}`).join(', ')}\n`;
          } else {
            introspect += `\n${ref} — NOT FOUND. Look for similar names in the schema catalog.\n`;
          }
        } catch {}
      }

      // Ask Claude to fix the SQL with this evidence
      const fixResp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 800,
          temperature: 0.0,
          system: SQL_GEN_SYSTEM,
          messages: [{
            role: 'user',
            content:
              `TODAY'S DATE: ${today}\n\n` +
              `SCHEMA CATALOG:\n${SCHEMA_CATALOG}\n\n` +
              `QUESTION: ${question}\n\n` +
              `PREVIOUS SQL FAILED:\n${sql}\n\n` +
              `ERROR: ${execError}\n\n` +
              `ACTUAL TABLE SCHEMAS (introspected):${introspect}\n\n` +
              `Fix the SQL using the actual columns above. Return ONLY the corrected SQL.`,
          }],
        }),
      });
      if (fixResp.ok) {
        const fixData = await fixResp.json() as { content: { type: string; text: string }[] };
        const fixedRaw = fixData.content.find(c => c.type === 'text')?.text ?? '';
        const fixedGuard = guardSql(fixedRaw);
        if (fixedGuard.ok) {
          retried = true;
          usedSql = (fixedGuard as { ok: true; sql: string }).sql;
          const retry = await tryExec(usedSql);
          if (retry.ok) {
            rows = retry.data!;
            columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            execError = null;
          } else {
            execError = `Original: ${execError}\nRetry: ${retry.msg}`;
          }
        }
      }
    }
  }

  if (execError) {
    return NextResponse.json({
      ok: false, stage: 'exec', error: execError, generated_sql: usedSql,
      retried,
    }, { status: 500 });
  }

  // --- 4. Natural-language answer (skip if no rows — answer "no data")
  let answer = '';
  if (rows.length === 0) {
    answer = `No rows for: "${question}". The query ran but returned 0 results — the data may not exist for the requested period or filter.`;
  } else {
    const tablePreview = JSON.stringify(rows.slice(0, 20), null, 2);
    const ansResp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        temperature: 0.2,
        system: ANSWER_SYSTEM_FULL,
        messages: [{
          role: 'user',
          content:
            `TODAY'S DATE: ${today}\n` +
            `(use this when stating periods — never invent past/future years)\n\n` +
            `QUESTION: ${question}\n\nSQL EXECUTED:\n${usedSql}\n\nRESULTS (${rows.length} rows, first 20 shown):\n${tablePreview}\n\nWrite a 1-3 sentence answer.`,
        }],
      }),
    });
    if (ansResp.ok) {
      const ansData = await ansResp.json() as { content: { type: string; text: string }[] };
      answer = ansData.content.find(c => c.type === 'text')?.text ?? '';
    } else {
      answer = `${rows.length} rows returned (see table).`;
    }
  }

  return NextResponse.json({
    ok: true,
    answer,
    sql: usedSql,
    rows: rows.slice(0, 200),
    columns,
    row_count: rows.length,
    retried,
  });
}
