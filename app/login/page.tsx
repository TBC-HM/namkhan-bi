// app/login/page.tsx
// Magic-link login page. Email input → POST /api/auth/login → neutral toast.
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorParam, setErrorParam] = useState<string | null>(null);

  if (typeof window !== "undefined" && errorParam === null) {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setErrorParam(e);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      setMessage(json.message ?? "If this email is allowed, a sign-in link has been sent.");
    } catch {
      setMessage("Sign-in temporarily unavailable. Try again in a minute.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0, #0d0d0d)", color: "var(--text-0, #f0f0f0)",
      fontFamily: "system-ui, sans-serif",
    }}>
      <form onSubmit={submit} style={{
        background: "var(--bg-1, #1a1a1a)", padding: "32px 36px", borderRadius: 12,
        width: "100%", maxWidth: 400, border: "1px solid var(--border, #2a2a2a)",
      }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.15em", color: "var(--brass, #c4a36a)",
          textTransform: "uppercase", marginBottom: 6,
        }}>The Namkhan · Workspace</div>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", margin: "0 0 24px", fontSize: 28 }}>
          Sign in
        </h1>
        <p style={{ color: "var(--text-2, #aaa)", fontSize: 13, marginBottom: 16 }}>
          Enter your email. If your address is allowed, we&apos;ll send you a magic-link.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@thenamkhan.com"
          autoFocus
          required
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 6,
            background: "var(--bg-2, #222)", color: "var(--text-0, #f0f0f0)",
            border: "1px solid var(--border-2, #333)", fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={sending || !email.trim()}
          style={{
            width: "100%", marginTop: 12, padding: "10px 12px",
            background: "var(--brass, #c4a36a)", color: "#000", fontWeight: 600,
            border: "none", borderRadius: 6, cursor: sending ? "wait" : "pointer",
            opacity: sending || !email.trim() ? 0.5 : 1, fontSize: 13,
          }}
        >{sending ? "Sending..." : "Send sign-in link"}</button>
        {message && (
          <div style={{ marginTop: 16, padding: 10, background: "var(--bg-2, #222)", borderRadius: 6, fontSize: 12 }}>
            {message}
          </div>
        )}
        {errorParam && (
          <div style={{ marginTop: 16, padding: 10, background: "rgba(179,38,30,0.15)", borderRadius: 6, fontSize: 12, color: "#ff8c84" }}>
            {errorParam === "access_revoked" && "Access revoked. Contact the workspace owner."}
            {errorParam === "invalid_token" && "Sign-in link expired or invalid. Request a new one."}
            {errorParam === "missing_token" && "Sign-in link is missing the verification token."}
            {!["access_revoked", "invalid_token", "missing_token"].includes(errorParam) && `Error: ${errorParam}`}
          </div>
        )}
      </form>
    </div>
  );
}
