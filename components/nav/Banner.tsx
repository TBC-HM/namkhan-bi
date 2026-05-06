// components/nav/Banner.tsx
import UserMenu from './UserMenu';
import InboxBadge from './InboxBadge';
import { getCurrentUser } from '@/lib/currentUser';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  titleEmphasis?: React.ReactNode;
  meta?: React.ReactNode;
}

async function getUnansweredCount(): Promise<number> {
  try {
    const sb = getSupabaseAdmin();
    const { count } = await sb.schema('sales').from('v_unanswered_threads')
      .select('thread_id', { count: 'exact', head: true })
      .eq('property_id', PROPERTY_ID);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function Banner({ eyebrow, title, titleEmphasis, meta }: Props) {
  const [user, unread] = await Promise.all([getCurrentUser(), getUnansweredCount()]);

  return (
    <div className="banner">
      <div className="banner-row">
        <div>
          {eyebrow && <div className="banner-eyebrow">{eyebrow}</div>}
          <div className="banner-title">
            {title}
            {titleEmphasis && <> · <em>{titleEmphasis}</em></>}
          </div>
        </div>
        <div className="banner-right">
          {meta && <div className="banner-meta">{meta}</div>}
          <InboxBadge unread={unread} />
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}
