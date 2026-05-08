'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function HomePage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: any key advances to dashboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      void router.push('/revenue-v2');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [router]);

  return (
    <div
      ref={containerRef}
      onClick={() => void router.push('/revenue-v2')}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,133,74,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Wordmark */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: 'rgba(168,133,74,0.6)',
            margin: 0,
          }}
        >
          The Namkhan · Small Luxury Hotels
        </p>

        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(32px, 5vw, 64px)',
            fontWeight: 400,
            color: '#efe6d3',
            margin: 0,
            letterSpacing: '0.05em',
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          Intelligence
        </h1>

        <div
          style={{
            width: 48,
            height: 1,
            background: 'rgba(168,133,74,0.4)',
            margin: '8px 0',
          }}
        />

        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(239,230,211,0.25)',
            margin: 0,
          }}
        >
          Click or press any key to enter
        </p>
      </div>

      {/* Bottom build stamp */}
      <p
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'rgba(239,230,211,0.12)',
          margin: 0,
        }}
      >
        NAMKHAN BI · ARCHITECT VIEW
      </p>
    </div>
  );
}
