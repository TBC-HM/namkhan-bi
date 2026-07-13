// app/account/page.tsx
// PBS 2026-07-09: personal profile page — name/preferred/phone/email/job_title.
// Reads app.profiles for the signed-in user, renders ProfileForm.
// PBS 2026-07-13: added Gmail connection link (settings/gmail).
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import ProfileForm from './_components/ProfileForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function currentUserId(): Promise<{ id: string; email: string } | null> {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.id || !user?.email) return null;
  return { id: user.id, email: user.email };
}

export default async function AccountPage() {
  const cur = await currentUserId();
  if (!cur) {
    return (
      <DashboardPage title="Account" subtitle="Sign in to view your profile">
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Not signed in" density="compact">
            <div style={{ padding: 12, fontSize: 12, color: '#3A3A3A' }}>
              You need to be signed in. <a href="/login" style={{ color: '#084838' }}>Go to sign in →</a>
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('v_app_profile_self')
    .select('*')
    .eq('user_id', cur.id)
    .maybeSingle();
  const { data: gmailConn } = await admin
    .from('v_user_gmail_connections')
    .select('gmail_address, active')
    .eq('user_id', cur.id)
    .eq('active', true)
    .maybeSingle();

  const initial = {
    full_name:      (profile?.full_name as string | null) ?? '',
    preferred_name: (profile?.preferred_name as string | null) ?? '',
    phone:          (profile?.phone as string | null) ?? '',
    job_title:      (profile?.job_title as string | null) ?? '',
    language_pref:  (profile?.language_pref as string | null) ?? 'en',
    email:          cur.email,
    dept_code:      (profile?.dept_code as string | null) ?? null,
    property_id:    (profile?.property_id as number | null) ?? null,
  };

  return (
    <DashboardPage title="Account" subtitle="Your personal profile — name, phone, job title, preferred language">
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Your profile" subtitle="These details appear across the app · Email is your login (change via Supabase support)" density="compact">
          <ProfileForm initial={initial} />
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Gmail" subtitle="Connect your @thenamkhan.com Google account to see your inbox in the top nav + send email from inside the app" density="compact">
          <div style={{ padding: 12, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {gmailConn?.active
                ? <>Connected as <strong>{gmailConn.gmail_address as string}</strong></>
                : <>Not connected</>}
            </div>
            <a href="/settings/gmail" style={{ color: '#084838', textDecoration: 'none', fontWeight: 600 }}>
              {gmailConn?.active ? 'Manage →' : 'Connect Gmail →'}
            </a>
          </div>
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Password" subtitle="Change your sign-in password" density="compact">
          <div style={{ padding: 12, fontSize: 12 }}>
            <a href="/account/password" style={{ color: '#084838', textDecoration: 'none', fontWeight: 600 }}>Change my password →</a>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
