# Runbook: Vercel hardening

Phase 5 of cockpit setup. Dashboard-driven; nothing here is auto-applied.

## Quick links

- Project dashboard: https://vercel.com/pbsbase-2825s-projects/namkhan-bi
- Project settings: https://vercel.com/pbsbase-2825s-projects/namkhan-bi/settings
- Team billing (spending cap): https://vercel.com/teams/pbsbase-2825s-projects/settings/billing
- Firewall: https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall
- Speed Insights: https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights
- Web Analytics: https://vercel.com/pbsbase-2825s-projects/namkhan-bi/analytics
- Vercel Agent (beta): check Project → top nav for "Agent" if available on your account

## Checklist (in order)

### 1. Spending cap — €30/month hard limit

**Why:** prevents a runaway agent action, traffic spike, or paid-tier overage from creating a surprise bill. €30 = ~10× baseline Pro headroom for namkhan-bi traffic; raise later if needed.

**Steps:**
1. https://vercel.com/teams/pbsbase-2825s-projects/settings/billing
2. Find "Spending limits" / "Usage limits" section
3. Set **Hard limit** to **€30/month** (USD equivalent if billed in $)
4. Save

**Verify:** dashboard shows the cap value; billing page reflects "Hard limit: €30".

---

### 2. Speed Insights — enable

**State:** client-side instrumentation already exists on branch `feat/leads-and-cockpit-redo` (`@vercel/speed-insights` package + `<SpeedInsights />` in `app/layout.tsx`). It will start sending events as soon as that branch reaches production AND Speed Insights is enabled on the project.

**Steps:**
1. https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights
2. Click **Enable Speed Insights** (free tier: 1k events/day on Pro)
3. Confirm

**Verify (after `feat/leads-and-cockpit-redo` is deployed to prod):**
- Speed Insights tab populates with Real-User Monitoring data within ~1 hour of the next prod deploy
- Spending cap (step 1) keeps cost bounded if traffic exceeds free tier

**No code change needed on `chore/cockpit-foundation`** — adding the package here would conflict with the install on `feat/leads-and-cockpit-redo`.

---

### 3. Web Analytics — enable

**State:** client-side instrumentation **not yet installed on any branch.**

**Steps:**
1. https://vercel.com/pbsbase-2825s-projects/namkhan-bi/analytics
2. Click **Enable Web Analytics**
3. Confirm (free up to 2.5k monthly events on Pro; paid above — spending cap from step 1 protects against runaway)

**Then add client-side on whichever branch reaches prod next** (recommend `feat/leads-and-cockpit-redo` since it already has Speed Insights and merging there keeps the diff small):

```bash
npm install @vercel/analytics
```

In `app/layout.tsx`, alongside the existing `<SpeedInsights />` import:

```tsx
import { Analytics } from '@vercel/analytics/next';
// ...
<body>
  {children}
  <SpeedInsights />
  <Analytics />
</body>
```

**Verify:** Analytics tab populates with pageviews within minutes of deploy.

---

### 4. Firewall — rate limit `/api/*` + block obvious-attack paths

**State:** Vercel Firewall is enabled by default on Pro. Custom rules go in the UI (cannot be committed via `vercel.json`).

**Steps:**
1. https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall
2. Open **Custom Rules** → **Add Rule**

**Rule A — Rate limit /api/*:**

| Field | Value |
|---|---|
| Name | `rate-limit-api` |
| Description | Rate limit API calls to 60/min per IP. Cockpit Phase 5. |
| Condition | **Request Path** → **Starts with** → `/api/` |
| Action | **Rate limit** |
| Limit | **60** requests per **60 seconds** |
| Window | per **IP address** |
| When exceeded | **Deny** (429) |

Click **Save** → **Activate**.

**Rule B — Block obvious-attack paths:**

| Field | Value |
|---|---|
| Name | `block-attack-paths` |
| Description | Block obvious script-kiddie probes. Cockpit Phase 5. |
| Condition | **Request Path** → **Matches Regex** → `^/(\.env\|\.git/\|wp-admin\|wp-login\|xmlrpc\.php\|\.aws/\|administrator/\|cgi-bin/\|phpmyadmin)` |
| Action | **Deny** (403) |

Click **Save** → **Activate**.

**Optional Rule C (if you want geo-allowlist):**

| Field | Value |
|---|---|
| Name | `geo-allowlist` |
| Condition | **Country** → **Not in** → list of countries you serve (e.g. `LA, FR, ES, DE, GB, US, CH, IT, NL, ...`) |
| Action | **Challenge** (Vercel CAPTCHA) |

Skip Rule C unless you've seen abuse traffic — it can break legitimate users behind VPNs.

**Verify:**
- `curl https://namkhan-bi.vercel.app/.env` → expect 403
- `curl https://namkhan-bi.vercel.app/wp-admin/` → expect 403
- Hit `/api/...` 70× from one IP within a minute → expect first ~60 OK, then 429

---

### 5. Vercel Agent — confirm beta access

**State:** Vercel Agent is in beta. Account access varies.

**Steps:**
1. https://vercel.com/pbsbase-2825s-projects/namkhan-bi
2. Look for **Agent** in the project nav (between Logs and Settings, typically) or in the right sidebar of a deployment
3. If present: click **Enable for project**. If absent: account doesn't have beta access yet — request via https://vercel.com/contact or wait for GA.

**Once enabled:** Vercel Agent does AI-powered code review on PRs and incident investigation. Integrates with the Cockpit Reviewer agent (`.claude/agents/reviewer.md`) — both check PRs but at different layers.

---

### 6. Log Drain — SKIPPED for now

**Why skipped:** Better Stack / uptime monitor not yet chosen (PBS answer #8 in Phase 0). Log drain is the connection from Vercel runtime logs → external log store; pointless without a destination.

**When to revisit:** after picking an uptime monitor (see `cockpit/architecture/stack.md` § Action items), set up a Better Stack workspace, then add Log Drain via:
- https://vercel.com/teams/pbsbase-2825s-projects/settings/log-drains
- Endpoint: Better Stack ingest URL
- Format: JSON
- Sources: All projects (or scope to namkhan-bi)

---

## Verification cheat sheet (after all steps done)

```bash
# 1. Spending cap visible
open "https://vercel.com/teams/pbsbase-2825s-projects/settings/billing"

# 2-3. Speed Insights & Analytics enabled (tabs show "Enabled" status)
open "https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights"
open "https://vercel.com/pbsbase-2825s-projects/namkhan-bi/analytics"

# 4. Firewall rules active
open "https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall"
curl -i https://namkhan-bi.vercel.app/.env             # expect HTTP/2 403
curl -i https://namkhan-bi.vercel.app/wp-admin/        # expect HTTP/2 403

# 5. Vercel Agent state visible
open "https://vercel.com/pbsbase-2825s-projects/namkhan-bi"
```

## Open follow-ups

- [ ] Add `@vercel/analytics` client install + `<Analytics />` component on the prod branch (`feat/leads-and-cockpit-redo` recommended)
- [ ] Pick uptime monitor → set up Log Drain (deferred)
- [ ] Decide custom domain → swap `namkhan-bi.vercel.app` references (done in 5 places: root CLAUDE.md, cockpit/architecture/stack.md, weekly-audit.yml, vercel-hardening.md (this file), brand-namkhan.md potentially)
