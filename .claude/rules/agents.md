paths: app/api/cockpit/**, scripts/*agent*, scripts/runner*, prompts/**, lib/bugAgent.ts

# Platform-agent rules

- Execution is queue-only: creating a ticket row triggers nothing. Agents run on @mention, skill-route invocation, or pg_cron. "Where is X's report?" -> check cockpit_audit_log before answering.
- Prompts live in the DB (public.cockpit_agent_prompts, loaded via fn_load_prompt_by_role). Repo prompts/*.md and hardcoded TS fallbacks are legacy — extend the DB row, don't add a fourth prompt home.
- Before proposing a new agent: SELECT role, display_name, dept FROM cockpit.id_agents WHERE dept='<dept>' — role KEYS differ from memory handles (code_spec_writer != "Quill Quincy"). A new capability extends an existing agent unless PBS approves a new identity. Naming an agent is owner-class. fn_estate_check does NOT search agents; hits:0 = not-found, not absent.
- Cost: every Anthropic call is metered (public.ai_token_meter); bug agent caps $2/run, $50/mo; runaway guard kills 5+ sessions/day on one brief. Model lock: Anthropic-only through Phase 2.
- Owner questions (money/taste/risk/priority only): plain language, 2-4 options with consequences, via the question row — an answer given in chat MUST be written to the question row in the same turn.
- The BRAIN is context-only — it never originates execution orders. 3-brain isolation: Namkhan 260955 / Donna 1000001 / Holding NULL — no cross-tenant retrieval, ever.