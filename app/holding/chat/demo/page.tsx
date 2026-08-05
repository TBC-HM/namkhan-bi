// app/holding/chat/demo/page.tsx
// CentralChat v2 demo page — showcase all new features
// Brief: central-chat-missing-ui-features

import CentralChat from '@/components/chat/CentralChat';

export default function ChatDemoPage() {
  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto',
      padding: '20px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif',
    }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1B1B1B' }}>
          CentralChat v2 — Feature Demo
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: '#5A5A5A' }}>
          Test the enhanced chat with conversation history, thread summarization, and save-to-KB features.
        </p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
      }}>
        {/* Demo 1: Second Brain with history */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#1B1B1B' }}>
            1. Second Brain + History Sidebar
          </h2>
          <p style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 12 }}>
            Toggle history with 📜 button, summarize with ∑, save answers with 💾
          </p>
          <CentralChat mode="second-brain" moduleScope="demo" showHistory={true} />
        </div>

        {/* Demo 2: General mode */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#1B1B1B' }}>
            2. General Mode (Model Only)
          </h2>
          <p style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 12 }}>
            No business data — brainstorming, writing, research
          </p>
          <CentralChat mode="general" />
        </div>
      </div>

      <div style={{ marginTop: 32, padding: 16, background: '#F4EFE2', borderRadius: 4 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1B1B1B' }}>
          Feature checklist (brief acceptance criteria)
        </h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: '#1B1B1B' }}>
          <li>✅ User can see past conversations and resume them → click 📜 button</li>
          <li>✅ User can one-click summarize any thread → click ∑ button (appears after 2+ messages)</li>
          <li>✅ User can save a brain answer to KB → click 💾 Save to KB on any assistant message</li>
          <li>✅ All 5 legacy chat surfaces replaced → revenue, finance, operations, university, brain settings</li>
          <li>✅ Model tier shown per-message → TierBadge component ready (reads model_tier from v_chat_messages)</li>
        </ul>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#8A8A8A', textAlign: 'center' }}>
        <a href="/holding/chat" style={{ textDecoration: 'underline', color: '#1F3A2E' }}>
          ← Back to full-screen chat
        </a>
        {' · '}
        <a href="/holding/it2/modules/briefs/central-chat-missing-ui-features" style={{ textDecoration: 'underline', color: '#1F3A2E' }}>
          View brief →
        </a>
      </div>
    </div>
  );
}
