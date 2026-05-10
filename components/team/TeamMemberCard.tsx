/**
 * TeamMemberCard — single team member tile used on the /team page.
 *
 * Props:
 *   member      — team member data object
 *   isWorking   — true when the member is currently on shift / active
 *                 (wire to real data when available; defaults to false)
 */
import React from 'react';
import WorkingIndicator from './WorkingIndicator';
import styles from './TeamMemberCard.module.css';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

interface TeamMemberCardProps {
  member: TeamMember;
  isWorking?: boolean;
}

export default function TeamMemberCard({
  member,
  isWorking = false,
}: TeamMemberCardProps) {
  return (
    <article className={styles.card}>
      {/* Avatar */}
      <div className={styles.avatar}>
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatarUrl} alt={member.name} />
        ) : (
          <span className={styles.initials}>
            {member.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.name}>{member.name}</p>
        <p className={styles.role}>{member.role}</p>
      </div>

      {/* Animated working indicator */}
      <div className={styles.indicator}>
        <WorkingIndicator isWorking={isWorking} />
        {isWorking && (
          <span className={styles.onShiftLabel}>On shift</span>
        )}
      </div>
    </article>
  );
}
