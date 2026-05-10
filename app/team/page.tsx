/**
 * /team page — lists all team members with the animated working indicator.
 *
 * Data: team members are fetched from Supabase `team_members` table.
 * isWorking is derived from `shift_schedules` or mocked to a
 * deterministic value (even index = working) until real shift data
 * is connected — swap the TODO section below when ready.
 */
'use client';

import React, { useEffect, useState } from 'react';
import Page from '@/components/primitives/Page';
import Panel from '@/components/primitives/Panel';
import TeamMemberCard, { TeamMember } from '@/components/team/TeamMemberCard';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import styles from './team.module.css';

interface TeamMemberRow extends TeamMember {
  isWorking: boolean;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function load() {
      // ── fetch team members ─────────────────────────────────
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, role, avatar_url')
        .order('name');

      if (error) {
        console.error('[TeamPage] fetch error', error);
        setLoading(false);
        return;
      }

      const rows: TeamMemberRow[] = (data ?? []).map(
        (row: { id: string; name: string; role: string; avatar_url?: string }, idx: number) => ({
          id: row.id,
          name: row.name,
          role: row.role,
          avatarUrl: row.avatar_url,
          // ── TODO: replace with real shift/presence query ───
          // e.g. check shift_schedules for today's date and
          // compare clock_in / clock_out times, or use
          // Supabase Realtime presence channels.
          isWorking: idx % 2 === 0, // mock: every other member shown as working
        })
      );

      setMembers(rows);
      setLoading(false);
    }

    load();
  }, [supabase]);

  return (
    <Page title="Team">
      <Panel title="Team members">
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : members.length === 0 ? (
          <p className={styles.empty}>No team members found.</p>
        ) : (
          <div className={styles.grid}>
            {members.map((m) => (
              <TeamMemberCard
                key={m.id}
                member={m}
                isWorking={m.isWorking}
              />
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
