// app/h/[property_id]/operations/maintenance/_components/AssetTable.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
"use client";
import Link from "next/link";

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
    return <div className="text-center py-8 text-gray-500">Loading assets...</div>;
  }

  if (assets.length === 0) {
    return <div className="text-center py-8 text-gray-500">No assets found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="text-left p-3 font-semibold">Code</th>
            <th className="text-left p-3 font-semibold">Name</th>
            <th className="text-left p-3 font-semibold">Category</th>
            <th className="text-left p-3 font-semibold">Location</th>
            <th className="text-left p-3 font-semibold">Status</th>
            <th className="text-left p-3 font-semibold">Manufacturer</th>
            <th className="text-left p-3 font-semibold">Model</th>
            <th className="text-right p-3 font-semibold">Tasks</th>
            <th className="text-left p-3 font-semibold">Last PM</th>
            <th className="text-left p-3 font-semibold">Next PM</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-3">
                <Link 
                  href={`/h/${propertyId}/operations/maintenance/assets/${asset.id}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {asset.asset_code}
                </Link>
              </td>
              <td className="p-3">{asset.asset_name}</td>
              <td className="p-3 text-sm text-gray-600">{asset.category_name}</td>
              <td className="p-3 text-sm text-gray-600">{asset.location_name}</td>
              <td className="p-3">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  asset.status === "active" ? "bg-green-100 text-green-800" :
                  asset.status === "maintenance" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {asset.status}
                </span>
              </td>
              <td className="p-3 text-sm">{asset.manufacturer || "—"}</td>
              <td className="p-3 text-sm">{asset.model || "—"}</td>
              <td className="p-3 text-right">{asset.maintenance_count}</td>
              <td className="p-3 text-sm">{asset.last_maintenance || "—"}</td>
              <td className="p-3 text-sm">{asset.next_maintenance || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
