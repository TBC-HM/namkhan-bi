// app/sales/inquiries/_components/EmailCockpit.tsx
// Server component — full-width Email Operations Cockpit on /sales/inquiries.
// Replaces the old BookInboxPanel. Designed to be reusable on /inbox later.
//
// Reads:
//  - sales.email_messages (via lib/sales-cockpit)
//  - sales.v_unanswered_threads
//  - sales.email_drafts
//  - sales.email_templates
//
// Writes (via /api/sales/email-draft):
//  - sales.email_drafts (AI draft, manual draft, template draft)
//  - PATCH for body/subject edit + status moves

import {
  searchThreads,
  getCockpitKpis,
  getThreadDetail,
  listMailboxes,
  listTemplates,
  listCategories,
  type CockpitFilters,
  type CockpitStatus,
  type CockpitDirection,
  type CockpitCategory,
  type CockpitSince,
} from '@/lib/sales-cockpit';
import CockpitClient from './CockpitClient';

interface Props {
  scope?: string;
  status?: CockpitStatus;
  direction?: CockpitDirection;
  category?: CockpitCategory;
  since?: CockpitSince;
  search?: string;
  page?: number;
  thread?: string;          // selected thread id
}

const PROPERTY_ID = 260955;

export default async function EmailCockpit({
  scope = 'all',
  status = 'unanswered',
  direction = 'all',
  category = 'people',
  since = '90d',
  search,
  page = 0,
  thread,
}: Props) {
  const filters: CockpitFilters = { scope, status, direction, category, since, search, page, pageSize: 25 };

  const [{ threads, hasMore }, kpis, mailboxes, templates, categories, threadDetail] = await Promise.all([
    searchThreads(filters, PROPERTY_ID),
    getCockpitKpis(PROPERTY_ID, scope),
    listMailboxes(PROPERTY_ID),
    listTemplates(),
    listCategories(),
    thread ? getThreadDetail(thread, PROPERTY_ID) : Promise.resolve(null),
  ]);

  return (
    <CockpitClient
      scope={scope}
      status={status}
      direction={direction}
      category={category}
      since={since}
      search={search ?? ''}
      page={page}
      threads={threads}
      hasMore={hasMore}
      kpis={kpis}
      mailboxes={mailboxes}
      templates={templates}
      categories={categories}
      selectedThreadId={thread ?? null}
      threadDetail={threadDetail}
    />
  );
}
