// app/revenue/compset/_components/property-detail/RoomMappingsTable.tsx
//
// Section 2 of the deep-view: per-channel room mappings (canonical DataTable).

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { EMPTY } from '@/lib/format';
import type { CompetitorRoomMappingRow } from '../types';

interface Props {
  rows: CompetitorRoomMappingRow[];
}

export default function RoomMappingsTable({ rows }: Props) {
  const columns: Column<CompetitorRoomMappingRow>[] = [
    {
      key: 'channel',
      header: 'CHANNEL',
      sortValue: (r) => r.channel ?? '',
      render: (r) => (r.channel ? r.channel.toUpperCase() : EMPTY),
    },
    {
      key: 'competitor_room_name',
      header: 'COMPETITOR ROOM NAME',
      sortValue: (r) => r.competitor_room_name ?? '',
      render: (r) => r.competitor_room_name ?? EMPTY,
    },
    {
      key: 'size',
      header: 'SIZE (m²)',
      numeric: true,
      sortValue: (r) => Number(r.competitor_room_size_sqm ?? 0),
      render: (r) =>
        r.competitor_room_size_sqm != null ? `${r.competitor_room_size_sqm}` : EMPTY,
    },
    {
      key: 'occupancy',
      header: 'MAX OCC',
      numeric: true,
      sortValue: (r) => Number(r.competitor_max_occupancy ?? 0),
      render: (r) => r.competitor_max_occupancy ?? EMPTY,
    },
    {
      key: 'beds',
      header: 'BEDS',
      render: (r) => r.competitor_bed_config ?? EMPTY,
    },
    {
      key: 'tier',
      header: 'OUR ROOM TIER',
      render: (r) => r.our_room_tier ?? EMPTY,
    },
    {
      key: 'target',
      header: 'TARGET?',
      align: 'center',
      render: (r) =>
        r.is_target_room ? <StatusPill tone="active">TARGET</StatusPill> : EMPTY,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.mapping_id}
      emptyState={
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
            No room mappings yet.
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
            Agent will populate after first deep scrape.
          </div>
        </div>
      }
    />
  );
}
