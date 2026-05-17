// components/nav/Banner.tsx
// Banner shell: eyebrow + title + meta row, PLUS the persistent TopNav
// horizontal strip that PBS Apple-note #18 (2026-05-13) requires on every
// page that uses this shell. The sub-menu line is rendered by the caller
// via <SubNav items={RAIL_SUBNAV[pillar]} /> *or* — for convenience — by
// passing `pillar` to Banner and letting it mount SubNav itself directly
// below the TopNav strip.
//
// Layout (top → bottom):
//   1. banner-row     — eyebrow + title + meta + user controls
//   2. <TopNav />     — 7-tab horizontal strip (always rendered)
//   3. <SubNav />     — pillar sub-tabs (only if `pillar` prop is set; if
//                        the page already renders SubNav externally that
//                        path still works untouched).

import UserMenu from './UserMenu';
import InboxBadge from './InboxBadge';
import TopNav from './TopNav';
import SubNav from './SubNav';
import { RAIL_SUBNAV } from './subnavConfig';
import { getCurrentUser } from '@/lib/currentUser';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  titleEmphasis?: React.ReactNode;
  meta?: React.ReactNode;
  /**
   * Optional convenience: when set, Banner renders <SubNav> directly under
   * the TopNav using RAIL_SUBNAV[pillar]. Pages may also continue to render
   * their own <SubNav> externally — both paths coexist.
   */
  pillar?: keyof typeof RAIL_SUBNAV;
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

export default async function Banner({ eyebrow, title, titleEmphasis, meta, pillar }: Props) {
  const [user, unread] = await Promise.all([getCurrentUser(), getUnansweredCount()]);
  const subnavItems = pillar ? RAIL_SUBNAV[pillar] : null;

  return (
    <>
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
      <TopNav />
      {subnavItems && subnavItems.length > 0 ? <SubNav items={subnavItems} /> : null}
    </>
  );
}
