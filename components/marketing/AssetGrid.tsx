// components/marketing/AssetGrid.tsx
// Server component — renders a responsive grid of AssetCards.

import AssetCard from './AssetCard';
import type { MediaAssetReady } from '@/lib/marketing';

interface Props {
  assets: MediaAssetReady[];
  emptyText?: string;
  emptyAction?: React.ReactNode;
  minColPx?: number;
}

function publicRenderUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/media-renders/${path}`;
}

export default function AssetGrid({ assets, emptyText, emptyAction, minColPx = 220 }: Props) {
  if (assets.length === 0) {
    return (
      <div className="stub" style={{ padding: 32, textAlign: 'center' }}>
        <h3>{emptyText ?? 'No assets yet'}</h3>
        {emptyAction}
      </div>
    );
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${minColPx}px, 1fr))`,
      gap: 12,
      marginTop: 8,
    }}>
      {assets.map(a => {
        const thumb = publicRenderUrl(a.renders?.thumbnail) ?? publicRenderUrl(a.renders?.web_2k);
        return <AssetCard key={a.asset_id} asset={a} thumbUrl={thumb} />;
      })}
    </div>
  );
}
