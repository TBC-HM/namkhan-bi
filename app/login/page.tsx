// app/login/page.tsx
// ADR-112. Google SSO (primary) + email/password (fallback).
// On success, redirect to ?next or the user's first property.
'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  async function password() {
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (error) { setErr(error.message); return }
    router.push(next)        // middleware re-checks claims on the next request
    router.refresh()
  }

  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center',
                  background:'var(--bg,#F4EFE2)' }}>
      <div style={{ width:340, padding:32, borderRadius:16,
                    background:'#fff', boxShadow:'0 8px 30px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize:20, marginBottom:24, color:'var(--primary,#1F3A2E)' }}>
          The Beyond Circle
        </h1>

        <button onClick={google}
          style={{ width:'100%', padding:'10px', marginBottom:20, borderRadius:8,
                   border:'1px solid #ddd', background:'#fff', cursor:'pointer' }}>
          Continue with Google
        </button>

        <div style={{ textAlign:'center', color:'#999', fontSize:12, margin:'8px 0' }}>or</div>

        <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)}
          style={{ width:'100%', padding:10, marginBottom:8, borderRadius:8, border:'1px solid #ddd' }} />
        <input placeholder="password" type="password" value={pw} onChange={e=>setPw(e.target.value)}
          style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ddd' }} />

        {err && <div style={{ color:'var(--terracotta,#B8542A)', fontSize:13, marginBottom:8 }}>{err}</div>}

        <button onClick={password} disabled={busy}
          style={{ width:'100%', padding:'10px', borderRadius:8, border:'none',
                   background:'var(--primary,#1F3A2E)', color:'#fff', cursor:'pointer' }}>
          {busy ? '…' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
