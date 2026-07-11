// app/marketing/media/_client/AssetEditPageClient.tsx
// PBS 2026-07-12 — Client wrapper for the standalone /marketing/media/edit/[asset_id]
// page. Auto-opens AssetEditDrawer so a deep link goes straight into edit mode.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AssetEditDrawer, { type AssetEditRow } from './AssetEditDrawer';

interface Props {
  asset: AssetEditRow;
  areaOptions: string[];
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST= '#084838';

export default function AssetEditPageClient({ asset, areaOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:24, display:'flex', gap:16, alignItems:'center' }}>
      {asset.public_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.public_url} alt={asset.original_filename ?? ''} style={{ width:160, height:120, objectFit:'cover', borderRadius:4, background:'#F5F0E1' }} />
      ) : (
        <div style={{ width:160, height:120, background:'#F5F0E1', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:INK_M }}>no preview</div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:600, color:INK }}>{asset.original_filename ?? asset.asset_id.slice(0,8)}</div>
        <div style={{ fontSize:12, color:INK_M }}>
          {asset.primary_tier ?? 'no tier'} · {asset.property_area ?? 'no area'}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={() => setOpen(true)} style={{
            padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE,
            border:'none', borderRadius:3, cursor:'pointer',
          }}>Edit ✎</button>
          <button onClick={() => router.push('/marketing/media')} style={{
            padding:'8px 14px', fontSize:12, fontWeight:600, background:WHITE, color:INK,
            border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer',
          }}>Back to Media</button>
        </div>
      </div>

      <AssetEditDrawer
        open={open}
        onClose={() => setOpen(false)}
        asset={asset}
        areaOptions={areaOptions}
      />
    </div>
  );
}
