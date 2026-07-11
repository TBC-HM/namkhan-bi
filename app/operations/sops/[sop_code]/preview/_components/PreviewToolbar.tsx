'use client';
// app/operations/sops/[sop_code]/preview/_components/PreviewToolbar.tsx
// PBS 2026-07-11 pm: client toolbar for the SOP preview — Print (window.print),
// Download .doc (server route), Edit, Send-by-email, Back. Kept as a client
// component only because window.print() is a browser API.

interface Props {
  sopCode: string;
  docxHref: string;
  editHref: string;
  sendHref: string;
}

export default function PreviewToolbar({ sopCode, docxHref, editHref, sendHref }: Props) {
  return (
    <div
      className="no-print"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '10px 14px',
        background: '#FFFFFF',
        border: '1px solid #E6DFCC',
        borderRadius: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5A5A', marginRight: 8 }}>
        SOP · {sopCode}
      </div>
      <button onClick={() => window.print()} style={btnPrimary}>Print / Save as PDF</button>
      <a href={docxHref} style={btnPrimary}>Download .doc</a>
      <a href={editHref} style={btnGhost}>Edit</a>
      <a href={sendHref} style={btnGhost}>Send by email</a>
      <a href="/operations/sops" style={{ ...btnGhost, marginLeft: 'auto' }}>← Back</a>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px',
  background: '#1F3A2E',
  color: '#FFFFFF',
  border: '1px solid #1F3A2E',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '6px 12px',
  background: '#FFFFFF',
  color: '#1F3A2E',
  border: '1px solid #E6DFCC',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
  cursor: 'pointer',
};
