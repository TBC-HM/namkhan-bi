'use client';
// components/seo/SeoLlmResponseCard.tsx
// Expandable LLM response card — platform + model badge, full text, mention highlight
import { useState } from 'react';

const GREEN = '#084838';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_F = '#8A8A8A';
const HAIR = '#E6DFCC';
const RED = '#B03826';

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  chatgpt:   { bg: '#10A37F',  color: '#fff' },
  openai:    { bg: '#10A37F',  color: '#fff' },
  perplexity:{ bg: '#20808D',  color: '#fff' },
  gemini:    { bg: '#4285F4',  color: '#fff' },
  google:    { bg: '#4285F4',  color: '#fff' },
  claude:    { bg: '#7B5EA7',  color: '#fff' },
  default:   { bg: '#5A5A5A',  color: '#fff' },
};

function platformColor(platform: string) {
  const key = platform.toLowerCase();
  for (const [k, v] of Object.entries(PLATFORM_COLORS)) {
    if (key.includes(k)) return v;
  }
  return PLATFORM_COLORS.default;
}

function platformLabel(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes('chatgpt') || p.includes('openai')) return 'ChatGPT';
  if (p.includes('perplexity')) return 'Perplexity';
  if (p.includes('gemini')) return 'Gemini';
  if (p.includes('google')) return 'Google AI';
  if (p.includes('claude')) return 'Claude';
  // Capitalise first letter as fallback
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** Highlight all occurrences of "namkhan" (case-insensitive) in green */
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(namkhan|thenamkhan\.com)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /namkhan|thenamkhan\.com/i.test(part) ? (
          <mark
            key={i}
            style={{
              background: '#E6F4EA',
              color: GREEN,
              fontWeight: 700,
              borderRadius: 2,
              padding: '0 2px',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface Props {
  prompt: string;
  response_text: string | null;
  our_domain_mentioned: boolean;
  platform: string;
  model?: string | null;
  fetched_at: string;
}

const PREVIEW_CHARS = 400;

export default function SeoLlmResponseCard({
  prompt,
  response_text,
  our_domain_mentioned,
  platform,
  model,
  fetched_at,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const pc = platformColor(platform);
  const pl = platformLabel(platform);
  const text = response_text ?? '';
  const needsTruncate = text.length > PREVIEW_CHARS;
  const displayText = expanded || !needsTruncate ? text : text.slice(0, PREVIEW_CHARS) + '…';

  return (
    <div
      style={{
        border: `1px solid ${our_domain_mentioned ? '#86CFA0' : HAIR}`,
        borderRadius: 6,
        padding: '12px 16px',
        background: our_domain_mentioned ? '#F6FBF8' : '#FFFFFF',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
        {/* Platform badge */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 9px',
            borderRadius: 99,
            background: pc.bg,
            color: pc.color,
            whiteSpace: 'nowrap' as const,
          }}
        >
          {pl}
        </span>
        {/* Model badge */}
        {model && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 99,
              background: '#F4EFE2',
              color: INK_M,
              fontFamily: 'ui-monospace,monospace',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {model}
          </span>
        )}
        {/* Mention badge */}
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 99,
            background: our_domain_mentioned ? '#E6F4EA' : '#FEE2E2',
            color: our_domain_mentioned ? GREEN : RED,
            fontWeight: 700,
            marginLeft: 'auto',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {our_domain_mentioned ? '✓ Namkhan mentioned' : '✗ Not mentioned'}
        </span>
      </div>

      {/* Prompt */}
      <div style={{ fontSize: 12, fontWeight: 600, color: INK, fontStyle: 'italic', marginBottom: 8 }}>
        {prompt}
      </div>

      {/* Response text */}
      {text ? (
        <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.65, whiteSpace: 'pre-wrap' as const }}>
          {our_domain_mentioned ? (
            <HighlightedText text={displayText} />
          ) : (
            displayText
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: INK_F, fontStyle: 'italic' }}>No response text stored.</div>
      )}

      {/* Show more / less */}
      {needsTruncate && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 8,
            fontSize: 11,
            color: GREEN,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontWeight: 600,
          }}
        >
          {expanded ? '▲ Show less' : '▼ Show full response'}
        </button>
      )}

      {/* Footer */}
      <div style={{ fontSize: 10, color: INK_F, marginTop: 8, fontFamily: 'ui-monospace,monospace' }}>
        {pl} · {fetched_at?.slice(0, 10) ?? '—'}
      </div>
    </div>
  );
}
