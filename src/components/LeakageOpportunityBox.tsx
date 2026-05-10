/**
 * LeakageOpportunityBox
 * Renders Leakage and Opportunity alert items with:
 *  - relative timestamp (e.g. '2h ago')
 *  - a 'View Case →' link to /cases/[id]
 *
 * Assumptions (ticket #610):
 *  - Alert records have shape: { id, type: 'leakage'|'opportunity', message, created_at, case_id }
 *  - Case detail route: /cases/[case_id]
 *  - Data is fetched via the existing hook/query and passed as `alerts` prop
 *  - If your actual prop/field names differ, adjust the destructuring below
 */
import React from 'react';
import Link from 'next/link';
import { getRelativeTime } from '../lib/relativeTime';

export interface Alert {
  id: string | number;
  type: 'leakage' | 'opportunity';
  message: string;
  created_at: string;
  case_id?: string | number;
}

interface Props {
  alerts: Alert[];
  /** Optionally filter to a single type; if omitted all alerts are shown */
  filterType?: 'leakage' | 'opportunity';
}

export default function LeakageOpportunityBox({ alerts, filterType }: Props) {
  const items = filterType ? alerts.filter((a) => a.type === filterType) : alerts;

  if (!items.length) {
    return (
      <p style={{ color: 'var(--t-muted, #888)', fontSize: 'var(--t-sm)' }}>
        No alerts.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {items.map((alert) => (
        <li
          key={alert.id}
          style={{
            borderLeft: `3px solid ${
              alert.type === 'leakage' ? 'var(--rust, #c0392b)' : 'var(--moss, #4a7c59)'
            }`,
            paddingLeft: '0.6rem',
          }}
        >
          {/* Message text */}
          <p
            style={{
              margin: 0,
              fontSize: 'var(--t-sm)',
              lineHeight: 1.4,
              color: 'var(--ink, #1a1a1a)',
            }}
          >
            {alert.message}
          </p>

          {/* Meta row: timestamp + case link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.25rem',
            }}
          >
            {/* Relative timestamp */}
            <span
              style={{
                fontSize: 'var(--t-xs, 0.72rem)',
                color: 'var(--t-muted, #888)',
              }}
            >
              {getRelativeTime(alert.created_at)}
            </span>

            {/* View Case link — only if case_id is present */}
            {alert.case_id != null && (
              <Link
                href={`/cases/${alert.case_id}`}
                style={{
                  fontSize: 'var(--t-xs, 0.72rem)',
                  color: 'var(--brass, #b8972e)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                View Case →
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
