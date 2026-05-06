export const dynamic = 'force-dynamic';

// app/guest/directory/page.tsx — banner version 2026-05-05
import Link from 'next/link';
import { createClient } from "@/lib/supabase/server";
import { supabase as anonClient, PROPERTY_ID } from "@/lib/supabase";
import { DirectoryShell } from "./_components/DirectoryShell";

export const revalidate = 300;

export default async function GuestDirectoryPage() {
  const sb = createClient();

  const [{ data: facets }, { data: headlineRows }, messyR] = await Promise.all([
    sb.schema("guest").from("v_directory_facets")
      .select("country, guest_count, total_revenue, total_stays, repeat_guests, contactable_email, contactable_phone, arriving_30d")
      .limit(60),
    sb.schema("guest").rpc("directory_headline"),
    anonClient.schema("guest").from("mv_guest_profile")
      .select("guest_id", { count: "exact", head: true })
      .eq("property_id", PROPERTY_ID).is("email", null).is("phone", null),
  ]);

  const headline = (headlineRows as any[])?.[0] ?? {
    total: 0, repeat_guests: 0, upcoming_total: 0, next_7: 0, next_30: 0, next_90: 0, contactable: 0,
  };
  const noContactCount = messyR.count ?? 0;

  return (
    <>
      {noContactCount > 0 && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderLeft: '3px solid var(--st-bad)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
            <strong style={{ color: 'var(--ink)' }}>{noContactCount.toLocaleString()}</strong>{' '}
            guest profile{noContactCount === 1 ? ' is' : 's are'} <em>unreachable</em> — no email + no phone.
          </div>
          <Link href="/guest/messy-data" style={{
            padding: '4px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 600,
            background: 'var(--st-bad)', color: 'var(--paper-warm)',
            border: '1px solid var(--st-bad)', borderRadius: 4, textDecoration: 'none',
          }}>
            OPEN MESSY DATA →
          </Link>
        </div>
      )}
      <DirectoryShell facets={(facets as any[]) ?? []} headline={headline} />
    </>
  );
}
