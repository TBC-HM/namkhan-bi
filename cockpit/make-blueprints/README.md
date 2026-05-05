# Make.com blueprints — import + setup

Best-effort importable Make.com blueprints for the cockpit scenarios. **Specs** (high-level descriptions for building from scratch) live one folder up at `../make-scenarios/`.

## What's here

| Blueprint | Status | Spec it implements |
|---|---|---|
| `04-weekly-audit-mailer.blueprint.json` | **Best-effort, omits Gmail step** | `../make-scenarios/04-weekly-audit-mailer.json` |
| `01-deploy-watcher.blueprint.json` | TODO — write after 04 verified | `../make-scenarios/01-deploy-watcher.json` |
| `05-incident-logger.blueprint.json` | TODO — write after 04 verified | `../make-scenarios/05-incident-logger.json` |

## Why these are best-effort

Make.com's blueprint JSON format is not fully publicly documented. Module versions and required fields can change. Imports may fail, succeed silently, or succeed with quirks. **Try the import — if it errors, copy the error and we'll fix.** The fallback is always: build the scenario from scratch in Make's UI using the spec at `../make-scenarios/`.

The blueprints use `http:ActionSendData` modules (generic HTTP requests) instead of native Make connectors (Supabase / Anthropic / Gmail apps) wherever possible, because the connector modules require pre-OAuth'd connections that exist only in your Make account — not portable in the blueprint JSON.

---

## Scenario 04 — Weekly Audit Mailer

### Step 1 — Import

1. https://eu1.make.com (or `us1.make.com` / `us2.make.com` — whichever zone your account uses; check the URL when you're already logged in)
2. **Scenarios** → **Create a new scenario** (top-right)
3. In the empty canvas, click the menu (`⋯`) → **Import Blueprint**
4. Upload `cockpit/make-blueprints/04-weekly-audit-mailer.blueprint.json`
5. **Expected:** 5 modules appear in a horizontal flow:
   - `Webhook` → `Supabase kpi_snapshots GET` → `Supabase incidents GET` → `Anthropic POST` → `Supabase kpi_snapshots UPSERT`

If import errors out: paste the error message back to Claude. The most common failures are:
- "Module version not found" → the http module version differs in your zone; change `version: 3` to `version: 1` or `version: 2` in the JSON and retry
- "Invalid module identifier" → name mismatch; common alternatives: `gateway:CustomWebHook` ↔ `webhook:CustomWebHook`
- "Hook reference invalid" → ignore on import; configure the webhook in step 2 below

### Step 2 — Activate the webhook (module 1) and copy URL

1. Click module 1 (the green Webhook icon)
2. Click **Add** → name the hook `weekly-audit-in` → **Save**
3. Click **Copy address to clipboard** → URL looks like `https://hook.eu1.make.com/abc123def456…`
4. Paste this URL into:
   - **GitHub Settings → Secrets and variables → Actions → New repository secret**
   - Name: `MAKE_AUDIT_WEBHOOK`
   - Value: (paste)

### Step 3 — Replace placeholder values

For each module that has a `REPLACE_WITH_*` string, click the module and edit the field:

| Module | Field | Replace with |
|---|---|---|
| 2. Supabase kpi GET | Headers `apikey` and `Authorization` | Supabase **service_role** key (Dashboard → Project Settings → API → reveal **service_role** key) |
| 3. Supabase incidents GET | Headers `apikey` and `Authorization` | same service_role key |
| 4. Anthropic POST | Header `x-api-key` | Your Anthropic API key (https://console.anthropic.com/settings/keys) |
| 4. Anthropic POST | Body `system` | The full `DIGEST_PROMPT` from `cockpit/make-scenarios/04-weekly-audit-mailer.json` (it's the long string starting with `"You are composing a weekly audit email for PBS…"`) |
| 5. Supabase upsert | Headers | same service_role key as 2/3 |

**Better practice (optional):** instead of pasting keys directly into headers, use Make's **Custom Variables** feature:
- Make → **Profile** (bottom-left avatar) → **Variables** → **Add variable**
- Add `SUPABASE_SERVICE_KEY` and `ANTHROPIC_API_KEY` as global vars
- Then in the modules, replace `REPLACE_WITH_…` with `{{$variables.SUPABASE_SERVICE_KEY}}` etc.
- Keys never appear in the blueprint JSON if you ever export it again

### Step 4 — Add the Gmail send module (between modules 4 and 5)

The blueprint omits Gmail send because OAuth has to happen inside Make. Add it now:

1. Click the small **+** between module 4 (Anthropic) and module 5 (Supabase upsert)
2. Search **Gmail** → choose **Send an email**
3. **Add a connection** → OAuth into the Google account that owns `data@thedonnaportals.com` (or whichever inbox should receive the digest) → **Save**
4. Configure the email:

   | Field | Value |
   |---|---|
   | To | `data@thedonnaportals.com` |
   | Subject | `📊 Weekly Cockpit Audit — {{formatDate(now; "YYYY-MM-DD")}}` |
   | Content | (right-side mapper) Pick `4. content[].text` — this is the markdown digest from Anthropic |
   | Content type | **HTML** (or **Plain text** if you prefer) |

5. **Save** the module

### Step 5 — Test the webhook

In the Make canvas, click **Run once** (bottom-left). The scenario waits for the next webhook.

In a separate terminal:
```bash
curl -X POST "<the-webhook-URL-from-step-2>" \
  -H "Content-Type: application/json" \
  -d '{"test": true, "audit_report": "## Test run\n- High vulns: 0\n- Critical vulns: 0"}'
```

Watch the Make canvas — modules should turn green one by one. If a module errors:
- Click the module → **Bundles** tab → see input/output → fix
- Common: header value typo, JSON escaping issue, Anthropic key invalid

### Step 6 — Activate

If the test run succeeds, toggle the scenario **ON** (top-right toggle). It will now respond every time `weekly-audit.yml` POSTs to the webhook.

### Step 7 — Trigger the GitHub workflow to verify end-to-end

```bash
gh workflow run weekly-audit.yml --repo TBC-HM/namkhan-bi
```

Or in the GitHub UI: **Actions** → **Weekly Audit** → **Run workflow**. ~2 min later you should receive the email at `data@thedonnaportals.com`.

---

## What about scenarios 01 and 05?

Build 04 first end-to-end. Once the import + token-replacement pattern is proven on 04, ask Claude to write blueprints for 01 (Deploy Watcher) and 05 (Incident Logger) using the same pattern.

## What about scenarios 02 and 03?

Deferred per Phase 0 inputs:
- **02 Uptime Watcher** — needs an uptime monitor (Better Stack TODO)
- **03 Email Intake** — needs `dev@` alias provisioned + Claude Code Web trigger endpoint confirmed
