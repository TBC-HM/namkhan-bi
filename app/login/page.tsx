'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: any) {
    e.preventDefault();
    setLoading(true); setErr('');
    const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
    if (r.ok) { window.location.href = '/overview'; }
    else { setErr('Incorrect password'); setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background:'#0e0e0e', color:'#e8e4dc', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <form onSubmit={submit} style={{ maxWidth: 360, width:'100%', padding: 32 }}>
        <div className="serif" style={{ fontSize: 28, marginBottom: 4, color:'#e8e4dc' }}>The Namkhan</div>
        <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color:'#7a7670', marginBottom: 28 }}>
          Owner intelligence
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          style={{
            width:'100%', padding: 12, background:'#161616',
            border:'1px solid #2a2a2a', color:'#e8e4dc',
            fontSize: 14, fontFamily: 'inherit'
          }}
        />
        <button
          type="submit" disabled={loading}
          style={{
            marginTop: 14, width:'100%', padding: 12,
            background:'#bfa980', color:'#1a1a1a', border:'none',
            fontSize: 11, letterSpacing: '.14em', textTransform:'uppercase',
            cursor: loading ? 'wait' : 'pointer'
          }}>
          {loading ? '…' : 'Enter'}
        </button>
        {err && <div style={{ marginTop: 12, color:'#c25450', fontSize: 11 }}>{err}</div>}
      </form>
    </div>
  );
}
