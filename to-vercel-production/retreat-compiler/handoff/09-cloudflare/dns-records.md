# Cloudflare DNS records — retreat-compiler

**Zone:** `thenamkhan.com`
**SSL mode:** Full (strict)
**Always Use HTTPS:** ON
**Min TLS version:** 1.2

## Records

| Type | Name | Value | TTL | Proxy |
|---|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | Auto | ✅ Proxied |
| CNAME | `www` | `cname.vercel-dns.com` | Auto | ✅ Proxied |
| CNAME | `*` | `cname.vercel-dns.com` | Auto | ✅ Proxied (wildcard for retreat subdomains) |
| CNAME | `try` | `cname.vercel-dns.com` | Auto | ✅ Proxied (campaigns) |
| TXT | `_vercel` | (token from Vercel domain settings) | Auto | DNS only |
| TXT | `@` | `v=spf1 include:_spf.google.com include:resend.com -all` | Auto | DNS only |
| MX | `@` | (existing — DO NOT TOUCH) | Auto | DNS only |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@thenamkhan.com` | Auto | DNS only |
| TXT | (per Resend instructions) | DKIM record from Resend dashboard | Auto | DNS only |

## SSL Universal vs Advanced

Universal SSL covers root + first-level subdomains free. **Wildcard SSL** for `*.thenamkhan.com` requires Advanced Certificate Manager ($10/mo) or Cloudflare Pro ($20/mo includes wildcard).

**Recommendation:** Cloudflare Pro covers wildcard + page rules + WAF in one.

## Page Rules / Cache Rules

| Match | Setting |
|---|---|
| `*.thenamkhan.com/_next/static/*` | Cache Level: Cache Everything · Edge TTL: 1 year |
| `*.thenamkhan.com/api/*` | Cache Level: Bypass |
| `*.thenamkhan.com/r/*` | Cache Level: Standard · Edge TTL: 5 min |
| `*.thenamkhan.com/og-image/*` | Cache Level: Cache Everything · Edge TTL: 7 days |
| `*.thenamkhan.com/sitemap.xml` | Cache Level: Standard · Edge TTL: 1 hour |
| `*.thenamkhan.com/robots.txt` | Cache Level: Standard · Edge TTL: 1 day |

## Firewall / Bot Management

| Rule | Action |
|---|---|
| Bot Fight Mode | ON (free tier) |
| Block list — known scraping ASNs | optional |
| Rate limit `/api/lead/capture` | 5 req/min/IP |
| Rate limit `/api/r/*/quote` | 30 req/min/IP |
| Rate limit `/api/checkout/session` | 3 req/min/IP |
| Rate limit anything else `/api/*` | 60 req/min/IP |

## Verification

After applying:

```bash
# Check apex resolves to Vercel
dig thenamkhan.com +short
# → 76.76.21.21

# Check wildcard
dig mindfulness-summer.thenamkhan.com +short
# → cname.vercel-dns.com → resolves to Vercel

# SSL chain
openssl s_client -connect thenamkhan.com:443 -servername thenamkhan.com < /dev/null
# → expect Cloudflare cert in chain

# HTTP → HTTPS redirect
curl -I http://thenamkhan.com
# → HTTP/1.1 301 Moved Permanently · Location: https://...
```
