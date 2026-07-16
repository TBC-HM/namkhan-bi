// app/marketing/subscribers/bookmarklet/page.tsx
// Static explainer + draggable bookmarklet. The JS in the href posts the current
// page's HTML to /marketing/scrape-popup via a small popup + postMessage.
// PBS 2026-07-16.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';

const PAPER = '#FFFFFF';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const BRAND = '#084838';
const HAIRLINE = '#E6DFCC';
const WARM = '#F5F0E1';

// Minified bookmarklet: opens the popup, sends HTML via postMessage.
// APP_BASE gets substituted at render time.
function bookmarkletHref(appBase: string): string {
  const script = `
(function(){
  var b=${JSON.stringify(appBase.replace(/\/$/, ''))};
  var u=encodeURIComponent(location.href);
  var t=encodeURIComponent(document.title.slice(0,200));
  var h=document.body?document.body.innerHTML.slice(0,20000):'';
  var w=window.open(b+'/marketing/scrape-popup?url='+u+'&title='+t,'nmkbi_scrape','width=520,height=560');
  if(!w){alert('Popup blocked — allow popups for this site and retry');return;}
  var handshake=function(e){
    if(!e.data||e.data.type!=='NMKBI_READY')return;
    w.postMessage({type:'NMKBI_HTML',html:h},'*');
    window.removeEventListener('message',handshake);
  };
  window.addEventListener('message',handshake);
})();`;
  return 'javascript:' + encodeURIComponent(script.replace(/\s+/g, ' ').trim());
}

export default async function BookmarkletPage() {
  const sb = getSupabaseAdmin();
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app';
  const href = bookmarkletHref(base);

  // Suppress unused warning
  void sb;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/subscribers',
  }));

  return (
    <div style={{ background: PAPER, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Subscribers · Bookmarklet"
        subtitle="One-click contact capture from any website."
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16, maxWidth: 720 }}>
          <div style={{ padding: 16, background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 6 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 12px 0', color: INK }}>Step 1 — Drag this button to your bookmarks bar</h2>
            <p style={{ fontSize: 12, color: INK_SOFT, margin: '0 0 16px 0' }}>
              (Not click — <strong>drag</strong>. Right-click also works: &ldquo;Bookmark this link…&rdquo;.)
            </p>
            <p style={{ textAlign: 'center', margin: '20px 0' }}>
              <a
                href={href}
                title="Drag me to your bookmarks bar"
                style={{
                  display: 'inline-block',
                  background: BRAND,
                  color: PAPER,
                  padding: '12px 24px',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                ✶ Save to Namkhan
              </a>
            </p>
            <p style={{ fontSize: 11, color: INK_SOFT, textAlign: 'center', margin: 0 }}>
              (Clicking it here will do nothing — it needs to be on a real website.)
            </p>
          </div>

          <div style={{ padding: 16, background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 6 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 12px 0', color: INK }}>Step 2 — Visit any website with contact info</h2>
            <p style={{ fontSize: 13, color: INK, lineHeight: 1.5, margin: '0 0 12px 0' }}>
              An agency directory, a Google Maps card, a LinkedIn profile, a retreat organiser&apos;s
              contact page. Click <strong>✶ Save to Namkhan</strong> in your bookmarks bar. A small
              popup opens showing what will be saved.
            </p>
          </div>

          <div style={{ padding: 16, background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 6 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 12px 0', color: INK }}>Step 3 — Choose Lead or Subscriber, add tags, save</h2>
            <ul style={{ fontSize: 13, color: INK, lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
              <li><strong>Lead</strong> — high-signal contact for the sales pipeline (creates a row in <code>sales.leads</code>).</li>
              <li><strong>Subscriber</strong> — bulk contacts for the newsletter list (adds to <code>marketing.newsletter_subscribers</code>, opt-in pending).</li>
            </ul>
            <p style={{ fontSize: 12, color: INK_SOFT, margin: '12px 0 0 0' }}>
              We&apos;ll extract all emails on the page, dedupe, filter noise (noreply@, mailer-daemon@, cid-embeds).
              An AI summary of the org gets attached automatically.
            </p>
          </div>

          <div style={{ padding: 12, background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 6, fontSize: 12, color: INK_SOFT }}>
            <strong style={{ color: INK }}>Browser notes:</strong>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, lineHeight: 1.6 }}>
              <li><strong>Chrome</strong> — drag the green button up to the bookmarks bar. If hidden, enable it with <code>Cmd+Shift+B</code>.</li>
              <li><strong>Safari</strong> — right-click the button → &ldquo;Add Link to Bookmarks…&rdquo; → choose Favorites Bar. Enable View → Show Favorites Bar.</li>
              <li><strong>Firefox</strong> — same as Chrome. Toolbar shown by default; toggle via View → Toolbars → Bookmarks Toolbar.</li>
              <li><strong>Popups blocked?</strong> The bookmarklet needs a popup — allow popups for the target site.</li>
            </ul>
          </div>
        </div>
      </DashboardPage>
    </div>
  );
}
