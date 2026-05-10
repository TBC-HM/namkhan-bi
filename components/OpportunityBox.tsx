/**
 * OpportunityBox — surfaces upsell/opportunity alert messages with relative
 * timestamps and links to the related case page (/cases/[id]).
 *
 * Ticket #590: added timeAgo display + case link on each row.
 */
import Link from 'next/link';
import { timeAgo } from '@/lib/timeAgo';

export interface OpportunityMessage {
  id: string | number;
  message: string;
  created_at?: string | null;
  case_id?: string | number | null;
}

interface OpportunityBoxProps {
  messages: OpportunityMessage[];
  /** Optional: total opportunity value for header KPI */
  totalLAK?: number;
}

export default function OpportunityBox({ messages, totalLAK }: OpportunityBoxProps) {
  return (
    <div className="opportunity-box">
      <div className="opportunity-box__header">
        <span className="opportunity-box__title">Opportunities</span>
        {totalLAK != null && (
          <span className="opportunity-box__kpi">{totalLAK.toLocaleString()} ₭</span>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="opportunity-box__empty">No opportunities flagged right now.</p>
      ) : (
        <ul className="opportunity-box__list">
          {messages.map((m) => (
            <li key={m.id} className="opportunity-box__item">
              {m.case_id ? (
                <Link
                  href={`/cases/${m.case_id}`}
                  className="opportunity-box__row opportunity-box__row--link"
                >
                  <span className="opportunity-box__msg">{m.message}</span>
                  <span className="opportunity-box__meta">
                    {m.created_at ? timeAgo(m.created_at) : ''}
                    <span className="opportunity-box__cta"> · View case →</span>
                  </span>
                </Link>
              ) : (
                <div className="opportunity-box__row">
                  <span className="opportunity-box__msg">{m.message}</span>
                  {m.created_at && (
                    <span className="opportunity-box__meta">{timeAgo(m.created_at)}</span>
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
