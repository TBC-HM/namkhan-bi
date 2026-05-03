// app/sales/_components/ComingSoon.tsx
// Generic placeholder for /sales/* sub-tabs not yet shipped.

interface Props {
  tab: string;            // 'Groups' / 'FIT' / etc.
  proposalLine: string;   // 1-line scope
}

export default function ComingSoon({ tab, proposalLine }: Props) {
  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: '#8a8170',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 14,
        }}
      >
        <strong style={{ color: '#4a4538' }}>Sales</strong> › {tab}
      </div>
      <h1
        style={{
          margin: '4px 0 2px',
          fontFamily: 'var(--serif)',
          fontWeight: 500,
          fontSize: 30,
        }}
      >
        {tab} · <em style={{ color: '#a17a4f' }}>coming</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>{proposalLine}</div>

      <div
        style={{
          marginTop: 18,
          padding: '14px 16px',
          background: '#fef3c7',
          border: '1px solid #f3d57a',
          borderRadius: 8,
          color: '#5e4818',
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        <strong>IA proposal pending.</strong> This sub-tab ships once the
        section-specific proposal is approved (see proposal index in the
        workspace folder). Inquiries is the keystone — every other Sales tab
        feeds off it.
      </div>
    </>
  );
}
