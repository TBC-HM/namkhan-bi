// lib/workspace-cookie.ts
// Sign + verify the workspace_session cookie payload.
// HMAC-SHA256 over base64url(JSON). Cookie format: <payload>.<sig>
//
// Edge-runtime compatible — uses Web Crypto SubtleCrypto, NOT node:crypto.
// Next.js middleware runs on Edge and can't import "node:crypto".
//
// Why no DB lookup: cookie carries the access flags signed with COOKIE_SECRET
// so middleware can trust them without re-querying workspace_users on every
// page load. Refresh the cookie when admin updates the row (or accept up to
// 30-day staleness — admin can flip active=false to instantly revoke since
// the API auth/login route re-checks active on each new cookie issue).

export type WorkspacePayload = {
  email: string;
  is_owner: boolean;
  access_revenue: boolean;
  access_sales: boolean;
  access_marketing: boolean;
  access_operations: boolean;
  access_finance: boolean;
  iat: number; // issued-at seconds
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa is available in Edge runtime
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s.replace(/-/g, "+").replace(/_/g, "/")) + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSecretBytes(): Uint8Array {
  const s = process.env.COOKIE_SECRET || process.env.COCKPIT_AGENT_TOKEN || "";
  if (!s || s.length < 16) {
    throw new Error("COOKIE_SECRET (or COCKPIT_AGENT_TOKEN fallback) not set or too short");
  }
  return enc.encode(s);
}

async function importHmacKey(): Promise<CryptoKey> {
  const bytes = getSecretBytes();
  // Cast to BufferSource via ArrayBuffer to satisfy strict DOM typings.
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return crypto.subtle.importKey(
    "raw",
    buf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function asArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export async function signWorkspaceCookie(p: WorkspacePayload): Promise<string> {
  const json = JSON.stringify(p);
  const payload = b64urlFromBytes(enc.encode(json));
  const key = await importHmacKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sig = b64urlFromBytes(new Uint8Array(sigBuf));
  return `${payload}.${sig}`;
}

export async function verifyWorkspaceCookie(cookie: string | undefined): Promise<WorkspacePayload | null> {
  if (!cookie || !cookie.includes(".")) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return null;
  let key: CryptoKey;
  try {
    key = await importHmacKey();
  } catch {
    return null;
  }
  let sigBytes: Uint8Array;
  try {
    sigBytes = bytesFromB64url(sig);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify("HMAC", key, asArrayBuffer(sigBytes), asArrayBuffer(enc.encode(payload)));
  if (!ok) return null;
  try {
    const obj = JSON.parse(dec.decode(bytesFromB64url(payload))) as WorkspacePayload;
    if (typeof obj.email !== "string") return null;
    return obj;
  } catch {
    return null;
  }
}
