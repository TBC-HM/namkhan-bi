// app/university/paths/[role]/page.tsx
// TBC University · one learning path — server shell. The interactive
// checklist / quiz / certificate lives in PathClient (client component,
// data via /api/university/progress). [role] = university.paths.slug.

import Breadcrumbs from '../../_components/Breadcrumbs';
import PathClient from './PathClient';
import { SANS } from '../../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LearningPathPage({ params }: { params: { role: string } }) {
  const pathSlug = decodeURIComponent(params.role ?? '').toLowerCase();
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <Breadcrumbs items={[
        { label: 'TBC University', href: '/university' },
        { label: 'Learning paths', href: '/university/paths' },
        { label: 'Path' },
      ]} />
      <PathClient pathSlug={pathSlug} />
    </div>
  );
}
