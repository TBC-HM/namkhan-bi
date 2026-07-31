export const dynamic = 'force-static';

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px', fontFamily: 'sans-serif', color: '#1B1B1B', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Terms of Service</h1>
      <p style={{ color: '#5A5A5A', marginBottom: 32 }}>The Namkhan BI · Last updated: July 31, 2026</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>1. Internal Use Only</h2>
      <p>Namkhan BI is a private internal hotel operations tool. Access is restricted to authorised employees of The Namkhan Resort. Unauthorised access is prohibited.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>2. YouTube API Compliance</h2>
      <p>Use of YouTube features within this tool must comply with:</p>
      <ul>
        <li><a href="https://www.youtube.com/t/terms" style={{ color: '#084838' }}>YouTube Terms of Service</a></li>
        <li><a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" style={{ color: '#084838' }}>YouTube API Services Terms of Service</a></li>
        <li><a href="https://policies.google.com/privacy" style={{ color: '#084838' }}>Google Privacy Policy</a></li>
      </ul>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>3. Acceptable Use</h2>
      <p>This tool may only be used to manage The Namkhan Resort&apos;s authorised YouTube channel. No misuse of YouTube API data is permitted. Users must not use this tool to violate YouTube&apos;s Community Guidelines or Terms of Service.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>4. Data Responsibility</h2>
      <p>The Namkhan Resort is responsible for ensuring all content published or modified via this tool complies with applicable laws and YouTube&apos;s policies.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>5. Disclaimer</h2>
      <p>This tool is provided for internal operations. The Namkhan Resort makes no warranties regarding availability or accuracy of data retrieved from YouTube API.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>6. Contact</h2>
      <p><a href="mailto:paul@thenamkhan.com" style={{ color: '#084838' }}>paul@thenamkhan.com</a><br/>The Namkhan Resort, Luang Prabang, Laos PDR</p>

      <p style={{ marginTop: 40, fontSize: 12, color: '#999', borderTop: '1px solid #E6DFCC', paddingTop: 16 }}>
        © 2026 The Namkhan Resort · <a href="/legal/privacy" style={{ color: '#5A5A5A' }}>Privacy Policy</a>
      </p>
    </div>
  );
}
