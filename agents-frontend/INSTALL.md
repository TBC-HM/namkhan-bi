# AI Agents Module — Install

12 files. Frontend-only, no DB changes. Drop into your repo, commit, push.

## What you get

**New top-level tab: AI Agents** (between Marketing and Finance)

| Sub-tab | What it shows |
|---|---|
| **Roster** | 10 agent cards in 6 category groups, hero banner, KPI strip |
| **Run** | Pick an agent → input form → fire → simulated streaming output |
| **History** | Mock past-run table with cost, duration, status |
| **Settings** | Edit prompt, swap model, change trigger/schedule, output routing |

## The 10 placeholder agents

| Agent | Category | Status |
|---|---|---|
| 📈 Pickup Predictor | Forecast | Draft |
| 💰 Pricing Coach | Revenue | Draft |
| 🍽️ F&B Capture Agent | F&B | Draft |
| 🌿 Spa Capture Agent | Spa | Draft |
| 🔀 OTA Mix Optimizer | Revenue | Draft |
| 📊 Outlook Agent | Forecast | Draft |
| 🔮 What-If Simulator | Revenue | Draft |
| ✍️ Review Responder | Marketing | Draft |
| 🔍 DQ Auditor | Ops | Draft |
| 👁️ Comp Set Watcher | Revenue | Draft |

All return realistic placeholder output that streams in like real AI. When you wire backend, replace `runStub()` in `AgentRunner.tsx` with a fetch.

## Install

```bash
cd /tmp/namkhan-bi-fresh

unzip -o ~/Downloads/namkhan-agents.zip -d /tmp/agents-staging
cp -r /tmp/agents-staging/agents-frontend/* .

# Append the agents CSS to globals.css
cat styles/agents.css >> styles/globals.css
rm styles/agents.css

git add -A
git status
```

Should show ~12 new/modified files (TopNav modified, rest new).

```bash
git commit -m "feat: AI Agents module — 10 placeholder agents with run/edit UI"
git push origin main
```

Vercel auto-deploys in ~2-3 min.

## How to add or edit agents

All agent definitions live in **`lib/agents.ts`**. To add an 11th agent, append to the `AGENTS` array:

```ts
{
  id: 'my-new-agent',
  name: 'My New Agent',
  category: 'revenue',
  emoji: '⚡',
  oneLiner: 'Does the thing',
  description: 'Longer explanation shown on detail page',
  inputs: [...],
  outputType: 'narrative',
  defaultPrompt: '...',
  model: 'claude-opus-4-7',
  status: 'draft',
  trigger: 'manual',
}
```

To make stub output realistic for the new agent, add an entry to `PLACEHOLDER_OUTPUTS` in `components/agents/AgentRunner.tsx`.

## Wiring real models (later)

When you want a real backend, three options:

1. **Anthropic API direct** — frontend calls Anthropic with the prompt + input vars. Fast to build, but exposes API key risk if not proxied.
2. **Vercel API route** — Next.js `/api/agents/[id]/run` proxies to Anthropic/Vertex. Recommended.
3. **Vertex AI Reasoning Engine** — heaviest lift, best for production scheduled agents. Needed for cron triggers.

I'd start with option 2: one Next API route, swap model based on `agent.model`, stream the response back to `AgentRunner`.

## What's NOT included

- No real model calls (everything is mocked)
- No persistence of edits (Settings page changes don't save)
- No actual scheduled execution (cron strings are display-only)
- No output routing (Slack/email/Telegram checkboxes are visual)
- No history of real runs (mock data in History tab)

All by design — this is the **design and UX shell** so you can show it, iterate the look, decide which agent to wire up first.
