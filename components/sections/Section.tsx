import { ReactNode } from 'react';

export function Section({
  title, tag, children, greyed, greyedReason
}: {
  title: string;
  tag?: string;
  children: ReactNode;
  greyed?: boolean;
  greyedReason?: string;
}) {
  return (
    <div className="section relative">
      <div className="section-head">
        <div className="section-title">{title}</div>
        {tag && <div className="section-tag">{tag}</div>}
      </div>
      <div className={greyed ? 'greyed-out' : ''}>{children}</div>
      {greyed && (
        <div className="greyed-out-overlay">
          <div className="greyed-out-overlay-content">
            Coming soon
            <small>{greyedReason || 'Not yet wired'}</small>
          </div>
        </div>
      )}
    </div>
  );
}

export function GreyPlaceholder({ reason }: { reason: string }) {
  return (
    <div className="section relative" style={{ minHeight: 200 }}>
      <div className="greyed-out-overlay">
        <div className="greyed-out-overlay-content">
          Coming soon
          <small>{reason}</small>
        </div>
      </div>
    </div>
  );
}
