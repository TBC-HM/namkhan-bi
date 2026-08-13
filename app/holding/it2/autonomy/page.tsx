// app/holding/it2/autonomy/page.tsx
// Autonomy Dashboard — autonomous-ops visibility (ADR-230 monitoring).
// Owner-approved 2026-08-13 via owner_questions id=28 (Option A: standalone dashboard).

import { createClient } from '@/lib/supabase/server'
import { TOKENS } from '@/components/cockpit/tokens'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const card: React.CSSProperties = {
  background: TOKENS.bgRaised,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 8,
  padding: '16px 20px',
}

const heading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: TOKENS.text2,
  marginBottom: 12,
}

const value: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: TOKENS.ink,
}

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${TOKENS.border}`,
  fontSize: 13,
}

const itemRow: React.CSSProperties = {
  padding: '10px 0',
  borderBottom: `1px solid ${TOKENS.border}`,
  fontSize: 12,
}

export default async function AutonomyPage() {
  const supabase = createClient()

  // Brief backlog by status
  const { data: allBriefs } = await supabase
    .from('v_build_briefs')
    .select('status')
  
  const briefCounts: Record<string, number> = {}
  allBriefs?.forEach((b: { status: string }) => {
    briefCounts[b.status] = (briefCounts[b.status] || 0) + 1
  })

  // Active builder heartbeats (last 30 min)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: heartbeats } = await supabase
    .from('v_builder_heartbeats')
    .select('brief_slug, worker_id, started_at, last_beat_at, current_step')
    .gte('last_beat_at', thirtyMinAgo)
    .is('finished_at', null)
    .order('last_beat_at', { ascending: false })
    .limit(10)

  // Recent push activity (last 20)
  const { data: pushes } = await supabase
    .from('v_push_ledger')
    .select('path, message, ok, pushed_at')
    .order('pushed_at', { ascending: false })
    .limit(20)

  // Open owner questions count
  const { count: openQuestionsCount } = await supabase
    .from('v_owner_questions_open')
    .select('*', { count: 'exact', head: true })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: TOKENS.ink, marginBottom: 6 }}>
          Autonomy Dashboard
        </h1>
        <p style={{ fontSize: 13, color: TOKENS.text2 }}>
          Live autonomous operations visibility — what agents are doing, push activity, backlog health.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Brief Backlog */}
        <div style={card}>
          <div style={heading}>Brief Backlog</div>
          {Object.keys(briefCounts).length > 0 ? (
            <div>
              {Object.entries(briefCounts).map(([status, count]) => (
                <div key={status} style={row}>
                  <span style={{ textTransform: 'capitalize' }}>{status}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: TOKENS.text2 }}>No briefs found</p>
          )}
        </div>

        {/* Active Builders */}
        <div style={card}>
          <div style={heading}>Active Builders (30min)</div>
          {heartbeats && heartbeats.length > 0 ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {heartbeats.map((hb: any, idx: number) => (
                <div key={idx} style={itemRow}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{hb.brief_slug}</div>
                  <div style={{ fontSize: 11, color: TOKENS.text2 }}>
                    {hb.worker_id} · {hb.current_step || 'running'}
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.text2 }}>
                    Last beat: {new Date(hb.last_beat_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: TOKENS.text2 }}>No active builders</p>
          )}
        </div>

        {/* Recent Pushes */}
        <div style={card}>
          <div style={heading}>Recent Push Activity</div>
          {pushes && pushes.length > 0 ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {pushes.map((push: any, idx: number) => (
                <div key={idx} style={itemRow}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                    <span style={{ color: push.ok ? '#2E7D32' : '#C62828', fontWeight: 700 }}>
                      {push.ok ? '✓' : '✗'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {push.path}
                      </div>
                      <div style={{ fontSize: 11, color: TOKENS.text2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {push.message}
                      </div>
                      <div style={{ fontSize: 10, color: TOKENS.text2, marginTop: 2 }}>
                        {new Date(push.pushed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: TOKENS.text2 }}>No recent pushes</p>
          )}
        </div>

        {/* Owner Questions */}
        <div style={card}>
          <div style={heading}>Open Owner Questions</div>
          <div style={value}>{openQuestionsCount ?? 0}</div>
          <p style={{ fontSize: 12, color: TOKENS.text2, marginTop: 8 }}>
            Questions awaiting owner decision
          </p>
        </div>
      </div>
    </div>
  )
}