// app/r/[slug]/page.tsx
// Public retreat detail page — SSR. Reads via public.v_retreats and
// public.v_compiler_variants proxy views (PostgREST doesn't surface the
// `web` / `compiler` schemas via .schema('web') for some sessions; the
// proxy views in `public` are the safe path).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtIsoDate, fmtKpi } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Day { day: number; title: string; am: string[]; pm: string[]; eve: string[]; skus: string[]; }

export default async function RetreatDetailPage({ params }: { params: { slug: string } }) {
  const admin = getSupabaseAdmin();
  const { data: retreat } = await admin
    .from('v_retreats')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!retreat) notFound();

  const { data: variant } = await admin
    .from('v_compiler_variants')
    .select('*')
    .eq('id', retreat.variant_id)
    .maybeSingle();

  const days = ((variant?.day_structure ?? []) as Day[]);
  const program = ((variant?.bookable_program ?? []) as any[]);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '60px 24px 100px', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      {/* Hero */}
      <div style={{
        marginBottom: 40,
        padding: '40px 32px',
        background: 'linear-gradient(135deg, var(--moss-deep, #243b2d) 0%, var(--moss, #3d6b4d) 100%)',
        color: 'var(--paper)',
        borderRadius: 4,
      }}>
        <div style={{
          fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass-soft, #d4b46d)', fontFamily: 'var(--mono)', marginBottom: 8,
        }}>
          The Namkhan {retreat.series_slug ? `· ${retreat.series_slug.replace(/-/g, ' ')}` : ''}
        </div>
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 'var(--t-3xl, 38px)', fontWeight: 500,
          fontStyle: 'italic', margin: '0 0 8px',
        }}>
          {retreat.name}
        </h1>
        <div style={{ fontSize: 'var(--t-base)', opacity: 0.85 }}>{retreat.tagline}</div>
        <div style={{ marginTop: 24, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 'var(--t-sm)' }}>
          <div>
            <div style={{ opacity: 0.6, fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>From</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-2xl)', fontStyle: 'italic' }}>
              {fmtKpi(retreat.price_usd_from, 'usd', 0)}
            </div>
            <div style={{ opacity: 0.7, fontSize: 'var(--t-xs)' }}>per pax</div>
          </div>
          <div>
            <div style={{ opacity: 0.6, fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>Window</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-base)' }}>{fmtIsoDate(retreat.arrival_window_from)} — {fmtIsoDate(retreat.arrival_window_to)}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6, fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>Spots</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-base)' }}>{retreat.spots_remaining} of {retreat.spots_total}</div>
          </div>
        </div>
        <Link
          href={`/r/${params.slug}/checkout`}
          style={{
            display: 'inline-block', marginTop: 24, padding: '12px 24px',
            background: 'var(--brass)', color: 'var(--ink)', textDecoration: 'none',
            borderRadius: 4, fontSize: 'var(--t-sm)', textTransform: 'uppercase',
            letterSpacing: 'var(--ls-extra)', fontWeight: 600,
          }}
        >
          Book this retreat →
        </Link>
      </div>

      {/* Itinerary */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{
          fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)', fontFamily: 'var(--mono)', margin: '0 0 14px',
        }}>
          Day by day
        </h2>
        {days.map(d => (
          <div key={d.day} style={{
            display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24,
            padding: '16px 0', borderBottom: '1px solid var(--ink-faint)',
          }}>
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 'var(--t-2xl)', fontStyle: 'italic',
              color: 'var(--brass)',
            }}>
              {d.day}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-lg, 18px)', fontStyle: 'italic', marginBottom: 6 }}>
                {d.title}
              </div>
              {d.am.length > 0 && <div style={{ fontSize: 'var(--t-sm)' }}><span style={{ color: 'var(--brass)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>AM</span> · {d.am.join(' · ')}</div>}
              {d.pm.length > 0 && <div style={{ fontSize: 'var(--t-sm)' }}><span style={{ color: 'var(--brass)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>PM</span> · {d.pm.join(' · ')}</div>}
              {d.eve.length > 0 && <div style={{ fontSize: 'var(--t-sm)' }}><span style={{ color: 'var(--brass)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>EVE</span> · {d.eve.join(' · ')}</div>}
            </div>
          </div>
        ))}
      </section>

      {/* Program */}
      {program.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
            color: 'var(--brass)', fontFamily: 'var(--mono)', margin: '0 0 14px',
          }}>
            What's included
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {program.map(p => (
              <div key={p.sku} style={{
                padding: 12, background: 'var(--paper-deep, #f5efdf)',
                borderRadius: 4, fontSize: 'var(--t-sm)',
              }}>
                <div><strong>{p.name}</strong></div>
                <div style={{ color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                  {p.sku} · {fmtKpi(p.per_pax_usd, 'usd', 0)} per pax
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lead magnet inline */}
      <section style={{
        marginTop: 60, padding: 24, background: 'var(--moss-soft, #5a8c66)',
        color: 'var(--paper)', borderRadius: 4,
      }}>
        <div style={{
          fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass-soft, #d4b46d)', fontFamily: 'var(--mono)', marginBottom: 8,
        }}>
          Stay in the loop
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg, 20px)', marginBottom: 14 }}>
          Get the next retreat first — and the lunar calendar.
        </div>
        <Link
          href={`/r/${params.slug}/lead`}
          style={{
            display: 'inline-block', padding: '10px 20px',
            background: 'var(--paper)', color: 'var(--ink)', textDecoration: 'none',
            borderRadius: 4, fontSize: 'var(--t-sm)', fontWeight: 600,
          }}
        >
          Subscribe →
        </Link>
      </section>
    </main>
  );
}
