'use client';

// Print + share controls for the printable revenue report.

interface Props {
  reportType: string;
}

export default function PrintControls({ reportType }: Props) {
  const onPrint = () => window.print();

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Report URL copied. Paste into the email or chat to share.');
    } catch {
      alert(window.location.href);
    }
  };

  const subject = encodeURIComponent(`Namkhan · ${reportType} report`);
  const body = encodeURIComponent(`Latest ${reportType} report:\n\n${typeof window !== 'undefined' ? window.location.href : ''}\n`);

  return (
    <div style={{ display: 'inline-flex', gap: 6 }} className="no-print">
      <button onClick={onPrint} style={btnStyle()} title="Print or save as PDF">🖨 Print</button>
      <button onClick={onShare} style={btnStyle()} title="Copy URL to clipboard">⎘ Copy link</button>
      <a
        href={`mailto:?subject=${subject}&body=${body}`}
        style={{ ...btnStyle(), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        title="Send via email"
      >
        ✉ Email
      </a>
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid #2a2520',
    color: '#d8cca8',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };
}
