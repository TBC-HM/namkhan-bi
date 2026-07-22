// app/h/[property_id]/operations/inventory/counts/CountsList.tsx
//
// Client wrapper for the recent-counts ListContainer.

'use client';

import { ListContainer, type ListContainerColumn } from '@/app/(cockpit)/_design';

export interface CountRow {
  count_id: string;
  count_date: string;
  location_name: string;
  count_type: string;
  status: string;
}

const COLUMNS: ListContainerColumn<CountRow>[] = [
  { key: 'count_date',    label: 'Date',     width: 120,
    render: (r) => <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{r.count_date}</span> },
  { key: 'location_name', label: 'Location',
    render: (r) => <span>{r.location_name}</span> },
  { key: 'count_type',    label: 'Type',     width: 120,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{r.count_type}</span> },
  { key: 'status',        label: 'Status',   width: 120,
    render: (r) => <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, textTransform: 'uppercase' }}>{r.status}</span> },
];

function renderPeekRow(r: CountRow) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 120px', gap: 12, alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{r.count_date}</span>
      <span style={{ fontSize: 13 }}>{r.location_name}</span>
      <span style={{ fontSize: 12, color: '#5A5A5A' }}>{r.count_type}</span>
      <span style={{ fontSize: 11, textTransform: 'uppercase' }}>{r.status}</span>
    </div>
  );
}

interface Props {
  title: string;
  data: CountRow[];
}

export default function CountsList({ title, data }: Props) {
  return (
    <ListContainer<CountRow>
      title={title}
      subtitle={`${data.length.toLocaleString('en-US')} counts on file`}
      data={data}
      preview={10}
      rowKey={(r) => r.count_id}
      renderRow={renderPeekRow}
      drawerColumns={COLUMNS}
      drawerDefaultSort={{ key: 'count_date', direction: 'desc' }}
      drawerSearchKeys={['location_name', 'count_type', 'status']}
      showAllLabel={`Show all ${data.length.toLocaleString('en-US')}`}
      empty={{ title: 'No counts yet', hint: 'Start a new count from a mobile device.' }}
    />
  );
}
