export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px', fontFamily: 'sans-serif', color: '#1B1B1B', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: '#5A5A5A', marginBottom: 32 }}>The Namkhan BI · Last updated: July 31, 2026</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>1. About This Application</h2>
      <p>Namkhan BI is a private, internal hotel operations tool for The Namkhan Resort, Luang Prabang, Laos. This application is not available to the public and is used exclusively by authorised hotel staff.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>2. YouTube API Services</h2>
      <p>This application uses YouTube API Services to manage The Namkhan Resort&apos;s YouTube channel. Our use of the YouTube API Services is governed by Google&apos;s Privacy Policy: <a href="https://policies.google.com/privacy" style={{ color: '#084838' }}>https://policies.google.com/privacy</a></p>
      <p>Data accessed via YouTube API includes:</p>
      <ul>
        <li>Channel video metadata (titles, descriptions, tags, thumbnails, statistics)</li>
        <li>Playlist information and video membership</li>
        <li>Video performance metrics (views, likes, comments)</li>
      </ul>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>3. How We Use YouTube Data</h2>
      <p>YouTube data is used solely for internal hotel marketing operations:</p>
      <ul>
        <li>Optimising video titles, descriptions and tags for the channel</li>
        <li>Organising videos into content playlists by property category</li>
        <li>Tracking content performance for internal reporting</li>
      </ul>
      <p>No YouTube data is sold, shared with third parties, or used for advertising purposes.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>4. Data Storage</h2>
      <p>YouTube data accessed by this tool is stored in a private encrypted database (EU Central region) accessible only to authorised hotel staff. OAuth tokens are stored encrypted and never exposed publicly.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>5. Data Deletion and Revocation</h2>
      <p>Users can revoke this application&apos;s access to YouTube data at any time by visiting: <a href="https://security.google.com/settings/security/permissions" style={{ color: '#084838' }}>Google Security Settings</a>. This immediately invalidates all stored access tokens. To request deletion of stored metadata, contact the system administrator.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>6. Third Parties</h2>
      <p>No YouTube data is shared with third parties. This application does not display advertisements.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 28 }}>7. Contact</h2>
      <p>For privacy inquiries: <a href="mailto:paul@thenamkhan.com" style={{ color: '#084838' }}>paul@thenamkhan.com</a><br/>The Namkhan Resort, Luang Prabang, Laos PDR</p>

      <p style={{ marginTop: 40, fontSize: 12, color: '#999', borderTop: '1px solid #E6DFCC', paddingTop: 16 }}>
        © 2026 The Namkhan Resort · <a href="/legal/terms" style={{ color: '#5A5A5A' }}>Terms of Service</a>
      </p>
    </div>
  );
}
