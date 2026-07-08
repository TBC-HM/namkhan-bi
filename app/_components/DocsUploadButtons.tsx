// app/_components/DocsUploadButtons.tsx
// PBS 2026-07-06: reusable upload button pair — guided upload + Supabase Storage
// link. Drop into any page that surfaces docs.
import TenantLink from '@/components/nav/TenantLink';
const HAIR='#E6DFCC'; const GREEN='#084838';
const SUPABASE_STORAGE_URL = 'https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/storage/buckets/dms-documents';

export default function DocsUploadButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display:'flex', gap:8 }}>
      <TenantLink href="/marketing/docs/upload" style={{ padding: compact ? '5px 12px' : '6px 14px', fontSize: compact ? 11 : 12, fontWeight:600, background:GREEN, color:'#FFFFFF', border:'1px solid '+GREEN, borderRadius:4, textDecoration:'none' }}>
        + Upload doc
      </TenantLink>
      <a href={SUPABASE_STORAGE_URL} target="_blank" rel="noreferrer" style={{ padding: compact ? '5px 12px' : '6px 14px', fontSize: compact ? 11 : 12, fontWeight:600, background:'#FFFFFF', color:GREEN, border:'1px solid '+HAIR, borderRadius:4, textDecoration:'none' }}>
        Supabase Storage ↗
      </a>
    </div>
  );
}
