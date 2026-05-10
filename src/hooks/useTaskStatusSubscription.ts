import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type TaskStatus = 'pending' | 'acknowledged' | 'in_progress' | 'resolved';

interface UseTaskStatusSubscriptionOptions {
  taskId: string;
  initialStatus?: TaskStatus;
}

export function useTaskStatusSubscription({
  taskId,
  initialStatus = 'pending',
}: UseTaskStatusSubscriptionOptions) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    // Fetch current status immediately
    supabase
      .from('tasks')
      .select('status')
      .eq('id', taskId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          console.error('[useTaskStatusSubscription] fetch error:', fetchError);
          setError(fetchError.message);
          return;
        }
        if (data?.status) setStatus(data.status as TaskStatus);
      });

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`task-status-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: TaskStatus }).status;
          if (newStatus) {
            console.log('[useTaskStatusSubscription] status update:', newStatus);
            setStatus(newStatus);
          }
        }
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'SUBSCRIBED') {
          console.log('[useTaskStatusSubscription] subscribed to task:', taskId);
        } else if (subscribeStatus === 'CHANNEL_ERROR') {
          console.error('[useTaskStatusSubscription] channel error for task:', taskId);
          setError('Real-time subscription failed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return { status, error };
}
