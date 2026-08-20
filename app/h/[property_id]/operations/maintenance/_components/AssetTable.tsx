// app/h/[property_id]/operations/maintenance/_components/AssetTable.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
// PM v3 slice 6 — design-system conformance: canonical table look comes from the
// global table rules in styles/globals.css (paper-white, hairline, mono caps
// headers); zero Tailwind color classes; status via .status-pill; counts tabular.
"use client";
import Link from "next/link";
import * as S from "./pmStyles";

type Asset = {
  id: number;
  asset_code: string;
  asset_name: string;
  category_name: string;
  location_name: string;
  status: string;
  manufacturer: string;
  model: string;
  maintenance_count: number;
  last_maintenance: string;
  next_maintenance: string
};

type AssetTableProps = {
  assets: Asset[];
  propertyId: number;
  loading?: boolean;
};

export default function AssetTable({ assets, propertyId, loading = false }: AssetTableProps) {
  if (loading) {
    return <div className="text-center py-8" style={S.muted}>Loading assets...</div>;
  }

  if (assets.length === 0) {
    return <div className="text-center py-8" style={S.muted}>No assets found</div>;
  }

  return (
    <div className="overflow-x-auto" style={{ border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--paper-warm)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Location</th>
            <th>Status</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th style={{ textAlign: "right" }}>Tasks</th>
            <th>Last PM</th>
            <th>Next PM</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td>
                <Link
                  href={`/h/${propertyId}/operations/maintenance/assets/${asset.id}`}
                  style={{ color: "var(--moss)", fontWeight: 500 }}
                >
                  {asset.asset_code}
                </Link>
              </td>
              <td>{asset.asset_name}</td>
              <td style={S.label}>{asset.category_name}</td>
              <td style={S.label}>{asset.location_name}</td>
              <td>
                <span className={S.statusPillClass(asset.status)}>{asset.status}</span>
              </td>
              <td>{asset.manufacturer || "—"}</td>
              <td>{asset.model || "—"}</td>
              <td style={{ textAlign: "right", ...S.num }}>{asset.maintenance_count}</td>
              <td style={S.num}>{asset.last_maintenance || "—"}</td>
              <td style={S.num}>{asset.next_maintenance || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
