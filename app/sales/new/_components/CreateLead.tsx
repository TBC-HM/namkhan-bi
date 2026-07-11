'use client';
// app/sales/new/_components/CreateLead.tsx
// PBS 2026-07-11 pm — Design System rebuild. NO raw div styling.
// Primitives used: Container, SplitContainer, KpiTile, MetricRow, Chart(cards).
// Two-column split via <SplitContainer/>:
//   LEFT  = <Container "New lead"> wrapping the form
//   RIGHT = <Container "Inbound queue"> wrapping <Chart variant="cards"/>
// Actions untouched: POST /api/sales/leads/create + /api/sales/inquiries/promote.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  SplitContainer,
  MetricRow,
  Chart,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';

export interface InboundRow {
  id: string; property_id: number; company: string | null; contact: string | null;
  email: string | null; phone: string | null; country: string | null;
  source: string | null; created_at: string | null;
}

const LEAD_TYPES = ['wholesale','dmc','agent','corp','retreat','other'];

// Light-theme tokens per design_system v6 · use tokens directly for form inputs.
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#1F3A2E';
const RED    = '#B00020';
const WHITE  = '#FFFFFF';
const CREAM  = '#F5F0E1';

export default function CreateLead({ inbound, propertyId, createdToday, convertedThisWeek }:
  { inbound: InboundRow[]; propertyId: number; createdToday?: number | null; convertedThisWeek?: number | null }) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ msg: string; leadId?: number; kind: 'ok'|'err' } | null>(null);
  const [busy, setBusy] = useState(false);

  const [company, setCompany] = useState('');
  const [type, setType]       = useState('wholesale');
  const [country, setCountry] = useState('');
  const [city, setCity]       = useState('');
  const [dmName, setDmName]   = useState('');
  const [dmRole, setDmRole]   = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [icp, setIcp]         = useState<number | ''>('');
  const [intent, setIntent]   = useState<number | ''>('');
  const [origin, setOrigin]   = useState<'outbound' | 'inbound'>('outbound');
  const [notes, setNotes]     = useState('');

  function resetForm() {
    setCompany(''); setType('wholesale'); setCountry(''); setCity('');
    setDmName(''); setDmRole(''); setEmail(''); setPhone('');
    setIcp(''); setIntent(''); setOrigin('outbound'); setNotes('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!company.trim()) { setBanner({ msg: 'Company name is required.', kind: 'err' }); return; }
    setBusy(true); setBanner(null);
    try {
      const res = await fetch('/api/sales/leads/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          company_name: company.trim(),
          type,
          country: country.trim() || null,
          city:    city.trim()    || null,
          decision_maker_name: dmName.trim() || null,
          decision_maker_role: dmRole.trim() || null,
          email:   email.trim() || null,
          phone_whatsapp: phone.trim() || null,
          icp_score:    icp === '' ? null : Number(icp),
          intent_score: intent === '' ? null : Number(intent),
          origin,
          notes: notes.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? ('HTTP ' + res.status));
      setBanner({ msg: 'Lead #' + j.lead_id + ' created at stage=New.', leadId: j.lead_id, kind: 'ok' });
      resetForm();
      router.refresh();
    } catch (err) {
      setBanner({ msg: 'Create failed: ' + (err instanceof Error ? err.message : String(err)), kind: 'err' });
    } finally {
      setBusy(false);
    }
  }

  async function promoteInquiry(inquiryId: string) {
    if (busy) return;
    setBusy(true); setBanner(null);
    try {
      const res = await fetch('/api/sales/inquiries/promote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiry_id: inquiryId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? ('HTTP ' + res.status));
      setBanner({ msg: 'Inbound inquiry added to pipeline (lead #' + j.lead_id + ' at Engaged).', leadId: j.lead_id, kind: 'ok' });
      router.refresh();
    } catch (err) {
      setBanner({ msg: 'Promote failed: ' + (err instanceof Error ? err.message : String(err)), kind: 'err' });
    } finally {
      setBusy(false);
    }
  }

  // ─── KPI strip via <MetricRow/> ─────────────────────────────────────────
  const kpiTiles: KpiTileProps[] = [
    { label: 'Inbound waiting', value: inbound.length, size: 'sm',
      status: inbound.length > 0 ? 'amber' : 'green',
      footnote: inbound.length > 0 ? 'awaiting triage' : 'queue clear' },
    { label: 'Created today', value: createdToday ?? '—', size: 'sm',
      footnote: 'manual + promoted' },
    { label: 'Manual conv · this week', value: convertedThisWeek ?? '—', size: 'sm',
      footnote: 'reached Won' },
  ];

  // ─── Left form ─────────────────────────────────────────────────────────
  const formPanel = (
    <Container title="New lead" subtitle="Manual entry — outbound or inbound" density="comfortable">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <Field label="Company name *">
          <input value={company} onChange={(e) => setCompany(e.target.value)} required style={INPUT} />
        </Field>

        <div style={ROW2}>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} style={INPUT}>
              {LEAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Origin">
            <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
              <label style={RADIO_LBL}>
                <input type="radio" checked={origin==='outbound'} onChange={() => setOrigin('outbound')} /> outbound
              </label>
              <label style={RADIO_LBL}>
                <input type="radio" checked={origin==='inbound'} onChange={() => setOrigin('inbound')} /> inbound
              </label>
            </div>
          </Field>
        </div>

        <div style={ROW2}>
          <Field label="Country">
            <input value={country} onChange={(e) => setCountry(e.target.value)} style={INPUT} />
          </Field>
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} style={INPUT} />
          </Field>
        </div>

        <div style={ROW2}>
          <Field label="Decision-maker name">
            <input value={dmName} onChange={(e) => setDmName(e.target.value)} style={INPUT} />
          </Field>
          <Field label="Decision-maker role">
            <input value={dmRole} onChange={(e) => setDmRole(e.target.value)} style={INPUT} placeholder="e.g. Director of Product" />
          </Field>
        </div>

        <div style={ROW2}>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={INPUT} />
          </Field>
          <Field label="Phone / WhatsApp">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={INPUT} />
          </Field>
        </div>

        <div style={ROW2}>
          <Field label={'ICP score (' + (icp === '' ? '—' : icp) + ')'}>
            <input type="range" min={0} max={100} value={icp === '' ? 0 : icp}
                   onChange={(e) => setIcp(Number(e.target.value))} style={{ width: '100%' }} />
          </Field>
          <Field label={'Intent score (' + (intent === '' ? '—' : intent) + ')'}>
            <input type="range" min={0} max={100} value={intent === '' ? 0 : intent}
                   onChange={(e) => setIntent(Number(e.target.value))} style={{ width: '100%' }} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    style={{ ...INPUT, resize: 'vertical', minHeight: 60 }} />
        </Field>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <button type="submit" disabled={busy} style={{ ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Creating…' : 'Create lead'}
          </button>
          <button type="button" onClick={resetForm} disabled={busy} style={BTN_SECONDARY}>Reset</button>
        </div>
      </form>
    </Container>
  );

  // ─── Right inbound queue via Chart cards variant ───────────────────────
  const inboundCards = inbound.map((q) => ({
    id: q.id,
    _row: q,
  }));

  const inboundPanel = (
    <Container
      title="Inbound queue"
      subtitle={inbound.length + ' awaiting triage'}
      density="comfortable"
    >
      {inbound.length === 0 ? (
        <div style={{ fontSize: 12, color: INK_M, padding: 16, textAlign: 'center' }}>
          No inbound Wholesale/B2B inquiries pending.
        </div>
      ) : (
        <Chart
          variant="cards"
          data={inboundCards}
          renderItem={(row) => {
            const q = (row as { _row: InboundRow })._row;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={SOURCE_PILL}>{q.source ?? '—'}</span>
                  <span style={{ fontSize: 10, color: INK_M }}>{fmtDate(q.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{q.company ?? '—'}</div>
                {q.contact ? <div style={{ fontSize: 11, color: INK_M }}>{q.contact}</div> : null}
                {q.email  ? <div style={{ fontSize: 11, color: INK_M, wordBreak: 'break-all' }}>{q.email}</div> : null}
                <button
                  onClick={() => promoteInquiry(q.id)}
                  disabled={busy}
                  style={{ ...BTN_PRIMARY_SMALL, marginTop: 4 }}
                >
                  Add to pipeline →
                </button>
              </div>
            );
          }}
        />
      )}
    </Container>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {banner ? (
        <div style={{
          gridColumn: '1 / -1',
          background: banner.kind === 'ok' ? FOREST : RED, color: WHITE,
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span>{banner.msg}</span>
          {banner.leadId ? (
            <a href="/sales/pipeline" style={{ color: WHITE, textDecoration: 'underline', fontWeight: 600 }}>Go to Pipeline →</a>
          ) : null}
          <button onClick={() => setBanner(null)} style={{ marginLeft: 'auto', background: 'transparent', color: WHITE, border: 'none', cursor: 'pointer', fontWeight: 600 }}>×</button>
        </div>
      ) : null}

      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={kpiTiles} size="sm" />
      </div>

      <SplitContainer left={formPanel} right={inboundPanel} ratio="1:1" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d); }
}

const ROW2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const INPUT: React.CSSProperties = { padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', color: INK, background: WHITE, width: '100%' };
const RADIO_LBL: React.CSSProperties = { fontSize: 12, color: INK, display: 'inline-flex', gap: 4, alignItems: 'center' };
const SOURCE_PILL: React.CSSProperties = { display: 'inline-block', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 6px', borderRadius: 2, background: CREAM, color: INK, fontWeight: 600 };
const BTN_PRIMARY: React.CSSProperties = { padding: '8px 14px', fontSize: 12, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 };
const BTN_PRIMARY_SMALL: React.CSSProperties = { ...BTN_PRIMARY, padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap', alignSelf: 'flex-start' };
const BTN_SECONDARY: React.CSSProperties = { padding: '8px 14px', fontSize: 12, background: CREAM, color: INK, border: '1px solid ' + HAIR, borderRadius: 4, cursor: 'pointer', fontWeight: 600 };
