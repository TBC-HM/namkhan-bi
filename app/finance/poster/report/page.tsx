// app/finance/poster/report/page.tsx
// Finance · Poster · Report — workable punchlist of findings + recommended
// actions. One row per problem the reconciliation matcher surfaced. Sorted
// by dollar impact (highest first).

import Link from 'next/link';
import SlimHero from '@/components/sections/SlimHero';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import {
  getPosterReportFindings, type PosterReportFindings,
  getPosterFindingDrilldown, type PosterFindingDrillRow, type PosterFindingKind,
  getPosterFindingReceipts, type PosterFindingReceipt,
  getPosterVsCbMonthly, type PosterVsCbMonth,
} from '@/lib/data-poster';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Finding {
  severity: 'high' | 'med' | 'low' | 'info';
  area: string;
  finding: string;
  count: number;
  usd: number | null;
  why: string;
  action: string;
  owner: string;
  /** Drilldown kind — links to a poster_finding_drilldown() bucket. */
  kind?: PosterFindingKind;
}

function buildFindings(f: PosterReportFindings): Finding[] {
  const list: Finding[] = [];

  list.push({
    severity: 'high', area: 'Reconciliation', kind: 'unmatchable',
    finding: 'Charge-to-room receipts with un-resolvable client',
    count: f.unmatchable_clients_n, usd: f.unmatchable_clients_usd,
    why: 'Manager typed staff names / generic placeholders / unrecognized labels in Poster\'s "client" field. Cannot tie back to a Cloudbeds reservation, so we don\'t know whose folio to check.',
    action: 'Train F&B manager: pick the actual guest from Poster\'s customer list (Customers screen). Stop typing room-type names. Audit Poster customer list to ensure all in-house guests appear.',
    owner: 'F&B manager · today',
  });
  list.push({
    severity: 'high', area: 'Hygiene', kind: 'open_receipts',
    finding: 'Open receipts never closed',
    count: f.open_receipts_n, usd: f.open_receipts_usd,
    why: 'Tables opened but never settled. Either the waiter forgot to close, or a real un-paid bill is sitting there.',
    action: 'Filter ledger by Status = Open, work the list newest-to-oldest. After 24h, an open receipt is almost always a forgotten close — set a daily 9pm "close all open" SOP.',
    owner: 'F&B manager · weekly',
  });
  list.push({
    severity: 'high', area: 'Audit', kind: 'without_payment',
    finding: '"Without payment" closed receipts',
    count: f.without_payment_n, usd: f.without_payment_usd,
    why: 'Receipts closed with no money taken AND no audit trail. Comps, voids, owner meals all dump here. Without a reason field, no way to tell legitimate from theft.',
    action: 'Reconfigure Poster: replace "Without payment" with explicit methods — "Comp · Manager", "Comp · Owner", "Void · spoil", "Staff meal" — each with a required reason.',
    owner: 'You · Poster admin',
  });
  list.push({
    severity: 'med', area: 'Reconciliation', kind: 'ambiguous_room',
    finding: 'Ambiguous room — multiple guests in same room type',
    count: f.ambiguous_room_n, usd: f.ambiguous_room_usd,
    why: 'Poster identified the room type ("Namkhan Deluxe") but two guests shared that room type that night. Cannot pick which folio to charge.',
    action: 'Add Poster\'s "Table" or order field to carry the actual room number (101, 203, etc.). Without room number on the receipt, ambiguous-room cases are unfixable retroactively.',
    owner: 'F&B manager · ongoing',
  });
  list.push({
    severity: 'med', area: 'Reconciliation', kind: 'amount_mismatch',
    finding: 'Amount mismatch — client matched, total differs',
    count: f.amount_mismatch_n, usd: f.amount_mismatch_usd,
    why: 'Reservation found, but Cloudbeds folio amount differs from Poster receipt by > 5%. Could be split bill, comped item, or amount typed wrong.',
    action: 'Click each row in the receipts ledger filter "amount_mismatch", check the Cloudbeds folio against the Poster receipt. Tag legitimate splits, fix the rest.',
    owner: 'You · monthly close',
  });
  list.push({
    severity: 'med', area: 'Reconciliation', kind: 'no_cb_lines',
    finding: 'No CB folio line — reservation found, no F&B charge',
    count: f.no_cb_lines_n, usd: f.no_cb_lines_usd,
    why: 'Poster says "charge to room", reservation exists, but no F&B charge ever made it onto the Cloudbeds folio. This is real revenue leakage.',
    action: 'Manually post each receipt to the right folio in Cloudbeds. Going forward, audit "Charge to Room" receipts daily — the post-to-folio workflow is broken.',
    owner: 'F&B manager · daily',
  });
  list.push({
    severity: 'low', area: 'Mapping',
    finding: 'Poster nicknames not mapped to Cloudbeds room types',
    count: f.unaliased_distinct_clients, usd: null,
    why: 'Manager invented nicknames like "Namkhan Tent", "River Side Villa", "Art Suite" that don\'t match any Cloudbeds room_type_name.',
    action: `Edit pos.poster_room_type_alias and add a row for each unaliased nickname. ${f.alias_review_n} existing aliases are marked 'review' — verify those first.`,
    owner: 'You · 30 minutes',
  });
  list.push({
    severity: 'low', area: 'Audit', kind: 'internal',
    finding: 'Internal / staff / management receipts',
    count: f.internal_n, usd: f.internal_usd,
    why: 'Bucket includes free breakfast, staff meals, owner consumption, IMekong invitations. Not bad per se, but should be tracked separately for cost control.',
    action: 'In Poster, split into: "Breakfast (incl)", "Staff meal", "Mgmt", "IMekong invite". Each gets its own line in the F&B P&L.',
    owner: 'You · Poster admin',
  });
  list.push({
    severity: 'info', area: 'Hygiene', kind: 'deleted_receipts',
    finding: 'Deleted / canceled receipts',
    count: f.deleted_receipts_n, usd: f.deleted_receipts_usd,
    why: 'Receipts deleted from Poster — could be legit (mistakes) or theft (delete after collecting cash). Audit trail required.',
    action: 'Pull Poster\'s deletion log monthly. Cross-check who deleted what. Set a policy: deletes need a manager PIN + reason.',
    owner: 'You · monthly',
  });

  // Sort by severity (high first), then by USD impact
  const sevOrder = { high: 0, med: 1, low: 2, info: 3 } as const;
  return list.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return (b.usd ?? 0) - (a.usd ?? 0);
  });
}

const SEV_TONE: Record<Finding['severity'], { color: string; bg: string }> = {
  high: { color: 'var(--bad, #b53a2a)',  bg: 'rgba(181, 58, 42, 0.08)' },
  med:  { color: 'var(--brass)',         bg: 'rgba(180, 130, 40, 0.08)' },
  low:  { color: 'var(--ink-soft)',      bg: 'rgba(180, 130, 40, 0.04)' },
  info: { color: 'var(--ink-soft)',      bg: 'transparent' },
};
const SEV_LABEL: Record<Finding['severity'], string> = {
  high: 'High', med: 'Medium', low: 'Low', info: 'Info',
};

export default async function PosterReportPage() {
  const f = await getPosterReportFindings();
  const findings = buildFindings(f);
  const totalImpact = findings.reduce((s, x) => s + (x.usd ?? 0), 0);
  const matchPct = f.charge_room_total_n > 0 ? (f.matched_green_n / f.charge_room_total_n) * 100 : 0;

  // Pull monthly summaries + a receipts sample per finding (parallel).
  const kinds = Array.from(new Set(findings.map((x) => x.kind).filter((k): k is PosterFindingKind => !!k)));
  const [drillRows, receiptRows, vsCb]: [
    Awaited<ReturnType<typeof getPosterFindingDrilldown>>[],
    Awaited<ReturnType<typeof getPosterFindingReceipts>>[],
    PosterVsCbMonth[],
  ] = await Promise.all([
    Promise.all(kinds.map((k) => getPosterFindingDrilldown(k))),
    Promise.all(kinds.map((k) => getPosterFindingReceipts(k, 200))),
    getPosterVsCbMonthly(),
  ]);
  const drillByKind:    Record<string, PosterFindingDrillRow[]>   = Object.fromEntries(kinds.map((k, i) => [k, drillRows[i]    ?? []]));
  const receiptsByKind: Record<string, PosterFindingReceipt[]>    = Object.fromEntries(kinds.map((k, i) => [k, receiptRows[i] ?? []]));

  return (
    <>
      <SlimHero
        eyebrow="Finance · Poster · Report"
        title="Findings"
        emphasis="& action plan"
        sub={`${findings.length} findings · ${matchPct.toFixed(1)}% of charge-to-room receipts reconcile clean today`}
      />

      <div style={{ marginBottom: 12 }}>
        <Link href="/finance/poster" style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
          textDecoration: 'none',
        }}>← Back to Poster ledger</Link>
      </div>

      {/* Headline strip */}
      <KpiStrip
        items={[
          { label: 'Findings',      value: findings.length, kind: 'count' },
          { label: 'Match rate',    value: matchPct, kind: 'pct', tone: matchPct > 80 ? 'pos' : matchPct > 40 ? 'warn' : 'neg', hint: `${f.matched_green_n} / ${f.charge_room_total_n} clean` },
          { label: 'Charge-to-room', value: f.charge_room_total_usd, kind: 'money', hint: `${f.charge_room_total_n} receipts` },
          { label: 'Open receipts $', value: f.open_receipts_usd, kind: 'money', tone: 'warn', hint: `${f.open_receipts_n} never closed` },
          { label: 'Without payment $', value: f.without_payment_usd, kind: 'money', tone: 'neg', hint: `${f.without_payment_n} closed comps/voids` },
          { label: '$ at risk',     value: totalImpact, kind: 'money', tone: 'warn', hint: 'sum of high+med findings' },
        ] satisfies KpiStripItem[]}
      />

      {/* Top-down monthly recon: Poster Charge-to-Room out vs Cloudbeds F&B in */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--t-lg)', marginBottom: 6 }}>
          Monthly <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>Poster ↔ Cloudbeds</em> recon
        </h2>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          What Poster says it sent to room ({'$'}<em>posted</em>) vs what Cloudbeds actually has on guest folios as F&amp;B ({'$'}<em>booked</em>).
          The two should be near-identical. They&apos;re not.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
            <thead style={{ background: 'var(--paper-warm)' }}>
              <tr>
                {[
                  { l: 'Month',         a: 'left'  as const },
                  { l: 'Poster total',  a: 'right' as const },
                  { l: 'Poster → room', a: 'right' as const },
                  { l: 'CB folio F&B',  a: 'right' as const },
                  { l: 'Δ CB − Poster', a: 'right' as const },
                  { l: 'Match %',       a: 'right' as const },
                ].map((c, i) => (
                  <th key={i} style={{
                    textAlign: c.a, padding: '6px 12px',
                    borderBottom: '2px solid var(--rule, #e3dfd3)',
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                    color: 'var(--brass)', fontWeight: 500,
                  }}>{c.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vsCb.map((r) => {
                const cell: React.CSSProperties = {
                  padding: '4px 12px',
                  borderBottom: '1px solid var(--rule, #e3dfd3)',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                };
                const matchTone =
                  r.match_pct == null ? 'var(--ink-soft)' :
                  r.match_pct >= 80   ? 'var(--good, #2c7a4b)' :
                  r.match_pct >= 30   ? 'var(--brass)' :
                                        'var(--bad, #b53a2a)';
                return (
                  <tr key={r.month_yyyymm}>
                    <td style={{ ...cell, textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{r.month_yyyymm}</td>
                    <td style={{ ...cell, color: 'var(--ink-soft)' }}>${Math.round(r.poster_total_usd).toLocaleString()}</td>
                    <td style={{ ...cell, color: r.poster_room_usd > 0 ? 'var(--ink)' : 'var(--ink-soft)' }}>
                      {r.poster_room_usd > 0
                        ? <>${Math.round(r.poster_room_usd).toLocaleString()} <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>· {r.poster_room_n}</span></>
                        : '—'}
                    </td>
                    <td style={cell}>
                      ${Math.round(r.cb_fnb_usd).toLocaleString()} <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>· {r.cb_fnb_n} lines</span>
                    </td>
                    <td style={{
                      ...cell,
                      color: Math.abs(r.delta_usd) > 5000 ? 'var(--bad, #b53a2a)' : Math.abs(r.delta_usd) > 1000 ? 'var(--brass)' : 'var(--ink)',
                      fontWeight: Math.abs(r.delta_usd) > 1000 ? 600 : 400,
                    }}>
                      {r.delta_usd === 0 ? '—' : `${r.delta_usd > 0 ? '+' : ''}$${Math.round(r.delta_usd).toLocaleString()}`}
                    </td>
                    <td style={{ ...cell, color: matchTone, fontWeight: 600 }}>
                      {r.match_pct == null ? '—' : `${r.match_pct.toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: 'rgba(181, 58, 42, 0.08)',
          borderLeft: '2px solid var(--bad, #b53a2a)',
          fontSize: 'var(--t-xs)', color: 'var(--ink)', lineHeight: 1.5,
        }}>
          <strong>Diagnosis:</strong> Poster&apos;s &quot;Charge to Room&quot; method went to <strong>$0</strong> in Nov 2025 and hasn&apos;t been used since.
          Cloudbeds folios still receive F&amp;B charges (~$10k/month). That means either (a) the manager switched to a different posting workflow that bypasses Poster&apos;s &quot;Charge to Room&quot; flag,
          (b) there&apos;s a parallel manual-posting path into Cloudbeds, or (c) Poster was reconfigured and old receipts are now being mis-tagged as &quot;Card&quot; or &quot;Without payment&quot;.
          Pull the Cloudbeds folio audit log for one Apr 2026 day and trace where the F&amp;B lines came from. That&apos;s the unblocking step.
        </div>
      </section>

      {/* Findings — one card per finding, with monthly drilldown inside */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--t-lg)', marginBottom: 6 }}>
          Action <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>punchlist</em>
        </h2>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          Sorted high → low severity, then by dollar impact. Click each row to see the receipts, grouped by month.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {findings.map((row, i) => {
            const sev = SEV_TONE[row.severity];
            const drill = row.kind ? drillByKind[row.kind] ?? [] : [];
            const drillTotal = drill.reduce((s, d) => s + d.usd, 0);
            return (
              <details key={i} style={{
                background: 'var(--paper-warm)',
                border: '1px solid var(--paper-deep)',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <summary style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)',
                    minWidth: 24, textAlign: 'right',
                  }}>{i + 1}</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                    color: sev.color, background: sev.bg,
                    padding: '2px 8px', borderRadius: 4, border: `1px solid ${sev.color}`,
                  }}>{SEV_LABEL[row.severity]}</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                    color: 'var(--ink-soft)',
                  }}>{row.area}</span>
                  <span style={{
                    fontFamily: 'var(--serif)', fontStyle: 'italic',
                    fontSize: 'var(--t-md)', flex: 1, minWidth: 200,
                  }}>{row.finding}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', textAlign: 'right', minWidth: 110 }}>
                    {row.count.toLocaleString()}
                    {row.usd != null && (
                      <> · <strong style={{ color: row.usd > 5000 ? 'var(--bad)' : 'var(--ink)' }}>${Math.round(row.usd).toLocaleString()}</strong></>
                    )}
                  </span>
                  <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', minWidth: 130, textAlign: 'right' }}>{row.owner}</span>
                </summary>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--paper-deep)' }}>
                  <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 6 }}>
                    <strong style={{ color: 'var(--ink)' }}>Why:</strong> {row.why}
                  </div>
                  <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink)', lineHeight: 1.5, background: 'rgba(180, 130, 40, 0.06)', borderLeft: '2px solid var(--brass)', padding: '6px 10px', marginBottom: 10 }}>
                    <strong>Action:</strong> {row.action}
                  </div>

                  {/* Monthly drilldown + receipts table */}
                  {row.kind ? (
                    drill.length === 0 ? (
                      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'italic', padding: '8px 0' }}>
                        No receipts in this bucket.
                      </div>
                    ) : (() => {
                      const receipts = receiptsByKind[row.kind!] ?? [];
                      // Index receipts by month for grouped render.
                      const byMonth: Record<string, typeof receipts> = {};
                      for (const r of receipts) {
                        const dt = (r.open_at ?? r.close_at ?? '').slice(0, 7);
                        if (!dt) continue;
                        if (!byMonth[dt]) byMonth[dt] = [];
                        byMonth[dt].push(r);
                      }
                      return (
                        <div>
                          {/* Compact monthly summary */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {drill.map((d) => (
                              <span key={d.month_yyyymm} style={{
                                display: 'inline-flex', gap: 6,
                                padding: '2px 8px', borderRadius: 4,
                                background: 'var(--paper-deep)',
                                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                <span style={{ color: 'var(--ink-soft)' }}>{d.month_yyyymm}</span>
                                <span style={{ color: 'var(--ink)' }}>{d.n}</span>
                                <span style={{ color: 'var(--ink-soft)' }}>·</span>
                                <span style={{ color: d.usd > 1000 ? 'var(--bad)' : 'var(--ink-soft)' }}>${Math.round(d.usd).toLocaleString()}</span>
                              </span>
                            ))}
                          </div>

                          {/* Per-receipt table grouped by month */}
                          <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
                              <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-warm)', zIndex: 1 }}>
                                <tr>
                                  {[
                                    { l: 'Date',   a: 'left'  as const },
                                    { l: '#',      a: 'right' as const },
                                    { l: 'Source', a: 'left'  as const },
                                    { l: 'Table',  a: 'left'  as const },
                                    { l: 'Poster client', a: 'left' as const },
                                    { l: 'Guest (CB)',    a: 'left' as const },
                                    { l: 'Room #',        a: 'left' as const },
                                    { l: 'Room type',     a: 'left' as const },
                                    { l: 'In-house?',     a: 'left' as const },
                                    { l: '$ order',       a: 'right' as const },
                                  ].map((c, j) => (
                                    <th key={j} style={{
                                      textAlign: c.a, padding: '6px 10px',
                                      borderBottom: '2px solid var(--paper-deep)',
                                      fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                      letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                                      color: 'var(--brass)', fontWeight: 500, whiteSpace: 'nowrap',
                                    }}>{c.l}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Object.keys(byMonth).sort().reverse().flatMap((m) => {
                                  const rs = byMonth[m];
                                  const monthSum = rs.reduce((s, r) => s + Number(r.order_total ?? 0), 0);
                                  return [
                                    <tr key={`hdr-${m}`} style={{ background: 'var(--paper-deep)' }}>
                                      <td colSpan={10} style={{
                                        padding: '4px 10px',
                                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                                        color: 'var(--brass)',
                                      }}>{m} · {rs.length} receipts · ${Math.round(monthSum).toLocaleString()}</td>
                                    </tr>,
                                    ...rs.map((r) => {
                                      const dt = r.open_at ?? r.close_at ?? '';
                                      return (
                                        <tr key={r.receipt_id}>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', whiteSpace: 'nowrap', color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{dt.slice(0, 16).replace('T', ' ')}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{r.receipt_id}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{r.order_source ?? '—'}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{r.table_label ?? '—'}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)' }}>{r.poster_client ?? '—'}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', color: r.cb_guest_name ? 'var(--ink)' : 'var(--ink-soft)' }}>{r.cb_guest_name ?? '—'}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: r.cb_room_no ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: r.cb_room_no ? 600 : 400 }}>{r.cb_room_no ?? '—'}</td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{r.cb_room_type ?? '—'}</td>
                                          <td style={{
                                            padding: '4px 10px',
                                            borderBottom: '1px solid var(--rule, #e3dfd3)',
                                            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                            color: r.cb_reservation_id == null
                                              ? 'var(--ink-soft)'
                                              : r.in_house_at_close
                                                ? 'var(--good, #2c7a4b)'
                                                : 'var(--bad, #b53a2a)',
                                          }}>
                                            {r.cb_reservation_id == null
                                              ? '—'
                                              : r.in_house_at_close
                                                ? 'in-house'
                                                : 'checked-out'}
                                          </td>
                                          <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule, #e3dfd3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                            {r.order_total != null ? `$${Number(r.order_total).toFixed(2)}` : '—'}
                                          </td>
                                        </tr>
                                      );
                                    }),
                                  ];
                                })}
                              </tbody>
                            </table>
                          </div>
                          {receipts.length >= 200 && (
                            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', marginTop: 6, fontStyle: 'italic' }}>
                              Showing the most-recent 200 receipts. Older rows are in the monthly summary above.
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                      No drilldown for this finding (it&apos;s a config / mapping issue, not a receipt-level fix).
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--t-lg)', marginBottom: 6 }}>
          Process <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>fix</em>
        </h2>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>
          Every finding above is a symptom of the same root cause: <strong>Poster receipts are not properly tied to Cloudbeds reservations</strong>. Two SOP changes solve 80% of this:
        </p>
        <ol style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.6, paddingLeft: 22 }}>
          <li><strong>At the table:</strong> waiter taps the customer field in Poster → picks the guest from the dropdown (which now lists tonight&apos;s in-house Cloudbeds guests). Never type the room type or &quot;Hotel Guest&quot;.</li>
          <li><strong>At end of shift:</strong> manager reviews open receipts — closes them or adds a delete reason. No receipt is allowed to stay Open past midnight.</li>
        </ol>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginTop: 10 }}>
          Coming next on this page: pulse-check button to re-run the matcher · per-finding drill-in linking back to the receipts ledger filtered to the matching rows · "mark as resolved" status with audit trail.
        </p>
      </section>

      <p style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', marginTop: 16 }}>
        Last reconciliation run: {f.reconciled_at ? new Date(f.reconciled_at).toLocaleString('en-GB') : '—'}.
      </p>
    </>
  );
}
