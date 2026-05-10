/**
 * LeakageBox — surfaces leakage alert messages with relative timestamps
 * and links to the related case page (/cases/[id]).
 *
 * Ticket #590: added timeAgo display + case link on each row.
 */
import Link from 'next/link';
import { timeAgo } from '@/lib/timeAgo';

export interface LeakageMessage {
  id: string | number;
  message: string;
  created_at?: string | null;
  case_id?: string | number | null;
}

interface LeakageBoxProps {
  messages: LeakageMessage[];
  /** Optional: total leakage amount for header KPI */
  totalLAK?: number;
}

export default function LeakageBox({ messages, totalLAK }: LeakageBoxProps) {
  return (
    <div className="leakage-box">
      <div className="leakage-box__header">
        <span className="leakage-box__title">Leakage Alerts</span>
        {totalLAK != null && (
          <span className="leakage-box__kpi">{totalLAK.toLocaleString()} ₭</span>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="leakage-box__empty">No leakage alerts — all clear.</p>
      ) : (
        <ul className="leakage-box__list">
          {messages.map((m) => (
            <li key={m.id} className="leakage-box__item">
              {m.case_id ? (
                <Link
                  href={`/cases/${m.case_id}`}
                  className="leakage-box__row leakage-box__row--link"
                >
                  <span className="leakage-box__msg">{m.message}</span>
                  <span className="leakage-box__meta">
                    {m.created_at ? timeAgo(m.created_at) : ''}
                    <span className="leakage-box__cta"> · View case →</span>
                  </span>
                </Link>
              ) : (
                <div className="leakage-box__row">
                  <span className="leakage-box__msg">{m.message}</span>
                  {m.created_at && (
                    <span className="leakage-box__meta">{timeAgo(m.created_at)}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
