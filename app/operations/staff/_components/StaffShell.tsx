'use client';

// app/operations/staff/_components/StaffShell.tsx
// PBS 2026-05-09: detail slides in from the right (drawer) instead of
// routing to /[staffId]. Holds selection state, renders StaffTable + drawer.

import { useCallback, useEffect, useState } from 'react';
import { StaffTable } from './StaffTable';
import { StaffDrawer } from './StaffDrawer';

type Row = Parameters<typeof StaffTable>[0]['rows'][number];

export function StaffShell({ rows }: { rows: Row[] }) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const handleClose = useCallback(() => setSelectedStaffId(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  return (
    <>
      <StaffTable rows={rows} onSelect={setSelectedStaffId} selectedId={selectedStaffId} />
      <StaffDrawer staffId={selectedStaffId} onClose={handleClose} />
    </>
  );
}
