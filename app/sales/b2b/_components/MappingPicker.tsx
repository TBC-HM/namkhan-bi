// app/sales/b2b/_components/MappingPicker.tsx
// Client component: dropdown to pick a contract + Confirm/Undo button.
// Calls server action confirmMapping / rejectMapping.

'use client';

import { useState, useTransition } from 'react';
import { confirmMapping, rejectMapping } from '../_actions';

interface ContractOption {
  contract_id: string;
  partner_short_name: string;
  country: string | null;
}

interface Props {
  reservationId: string;
  contracts: ContractOption[];
  initialContractId: string | null;          // suggested or already-mapped
  initialMappedStatus: 'mapped' | 'unmapped';
  meta: {
    source_name?: string | null;
    rate_plan?: string | null;
    total_amount?: number | null;
    check_in_date?: string | null;
  };
}

export default function MappingPicker({
  reservationId,
  contracts,
  initialContractId,
  initialMappedStatus,
  meta,
}: Props) {
  const [selected, setSelected] = useState(initialContractId ?? '');
  const [status, setStatus] = useState(initialMappedStatus);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const isMapped = status === 'mapped';

  const onConfirm = () => {
    if (!selected) {
      setErr('pick a partner');
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await confirmMapping(reservationId, selected, meta);
      if (r.ok) {
        setStatus('mapped');
      } else {
        setErr(r.error ?? 'failed');
      }
    });
  };

  const onUndo = () => {
    setErr(null);
    startTransition(async () => {
      const r = await rejectMapping(reservationId);
      if (r.ok) {
        setStatus('unmapped');
        setSelected('');
      } else {
        setErr(r.error ?? 'failed');
      }
    });
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={pending || isMapped}
        style={{
          border: '1px solid #d9d2bc',
          borderRadius: 4,
          padding: '3px 6px',
          fontSize: 11,
          background: isMapped ? '#f0eadb' : '#fff',
          color: '#4a4538',
          maxWidth: 160,
        }}
      >
        <option value="">— pick partner —</option>
        {contracts.map((c) => (
          <option key={c.contract_id} value={c.contract_id}>
            {c.partner_short_name}
          </option>
        ))}
      </select>
      {isMapped ? (
        <button
          type="button"
          onClick={onUndo}
          disabled={pending}
          style={{
            background: '#fff',
            color: '#a83232',
            border: '1px solid #e2a8a8',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? '…' : 'Undo'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || !selected}
          style={{
            background: pending || !selected ? '#bdb39a' : '#1f6f43',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '3px 9px',
            fontSize: 11,
            cursor: pending || !selected ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? '…' : 'Confirm'}
        </button>
      )}
      {err && <span style={{ color: '#a83232', fontSize: 10.5, marginLeft: 4 }}>{err}</span>}
    </div>
  );
}
