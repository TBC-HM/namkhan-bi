import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTaskStatusSubscription, TaskStatus } from '../hooks/useTaskStatusSubscription';

interface AlertStatusButtonProps {
  taskId: string;
  initialStatus?: TaskStatus;
  onStatusChange?: (status: TaskStatus) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pick Up',
  acknowledged: 'Acknowledge',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const STATUS_NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
  pending: 'acknowledged',
  acknowledged: 'in_progress',
  in_progress: 'resolved',
};

const STATUS_STYLES: Record<TaskStatus, React.CSSProperties> = {
  pending: { background: 'var(--red, #c0392b)', color: '#fff' },
  acknowledged: { background: 'var(--amber, #e67e22)', color: '#fff' },
  in_progress: { background: 'var(--moss, #4a7c59)', color: '#fff' },
  resolved: { background: 'var(--brass, #a07840)', color: '#fff' },
};

export function AlertStatusButton({
  taskId,
  initialStatus = 'pending',
  onStatusChange,
}: AlertStatusButtonProps) {
  const { status, error: subscriptionError } = useTaskStatusSubscription({
    taskId,
    initialStatus,
  });
  const [loading, setLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const nextStatus = STATUS_NEXT[status];

  async function handleClick() {
    if (!nextStatus || loading) return;
    setLoading(true);
    setUpdateError(null);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', taskId);

      if (error) {
        console.error('[AlertStatusButton] update error:', error);
        setUpdateError(error.message);
      } else {
        console.log('[AlertStatusButton] status updated to:', nextStatus);
        onStatusChange?.(nextStatus);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[AlertStatusButton] unexpected error:', msg);
      setUpdateError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={!nextStatus || loading}
        style={{
          ...STATUS_STYLES[status],
          padding: '0.5rem 1.25rem',
          border: 'none',
          borderRadius: '4px',
          fontSize: 'var(--t-sm)',
          cursor: nextStatus && !loading ? 'pointer' : 'not-allowed',
          opacity: loading ? 0.7 : 1,
          transition: 'background 0.2s ease',
          fontWeight: 600,
        }}
        aria-label={`Task status: ${status}${nextStatus ? ` — click to mark ${nextStatus}` : ''}`}
      >
        {loading ? 'Updating…' : STATUS_LABELS[status]}
      </button>
      {(updateError || subscriptionError) && (
        <p
          role="alert"
          style={{
            color: 'var(--red, #c0392b)',
            fontSize: 'var(--t-xs)',
            marginTop: '0.25rem',
          }}
        >
          {updateError ?? subscriptionError}
        </p>
      )}
    </div>
  );
}

export default AlertStatusButton;
