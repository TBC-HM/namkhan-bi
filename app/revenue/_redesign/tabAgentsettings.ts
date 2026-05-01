// Revenue · Agents tab — REVENUE-SPECIFIC content only.
// Global guardrails (detection · approval matrix · data quality · audit · kill switch · operating mode)
// live at /settings/agents. Marketing-related spend guardrails live at /marketing/agents.
// This tab keeps: prompt library (revenue agents), action guardrails (rate-related),
// brand & strategy (revenue-specific), per-agent overrides.
//
// Inline onclick="openAgent('id')" calls are intercepted by components/agents/AgentEditModal.tsx
// (mounted globally in app/layout.tsx) which exposes window.openAgent.

export default `<div class="tab-content active" id="tab-agentsettings">

  <!-- Pointer to global settings -->
  <div class="design-note" style="background:rgba(168,133,74,0.10);border-left:3px solid var(--brass);">
    <strong>Revenue agents · 9 agents.</strong> This page configures rate, restriction, blackout, and brand-positioning rules that apply to <em>revenue</em> agents specifically. Global controls (operating mode, detection thresholds, approval matrix, data quality, audit trail, master kill switch) live at <a href="/settings/agents" class="clickable" style="color:var(--accent);font-weight:600;">Settings → Agent guardrails →</a>
  </div>

  <div class="gr-sim-banner">
    <strong>🧪 Dry-run available:</strong>
    Click "Simulate" on any rule to see how it would have applied to the last 30 days of decisions before you commit changes. Recommended before every guardrail edit.
    <button class="btn" style="margin-left:auto;font-size:10px;padding:3px 10px;">Run 30d simulation</button>
  </div>

  <!-- ============= PROMPT LIBRARY (Revenue agents) ============= -->
  <div class="gr-layer">
    <div class="gr-layer-header" onclick="toggleLayer(this)">
      <div class="gr-layer-title"><span class="gr-layer-num">📝</span>Agent prompts · what each agent is told to do</div>
      <div class="gr-layer-meta">9 system prompts · all editable · versioned · A/B testable</div>
    </div>
    <div class="gr-layer-body">

      <div class="design-note" style="margin-top:0;">
        <strong>Click any agent name to open the full editor</strong> — prompt, knowledge, triggers, per-agent guardrail overrides, allowed tools, output, backtest, metrics, and history. Every change creates a new version with rollback.
      </div>

      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Current prompt</th>
            <th>Last edit</th>
            <th>Knowledge files</th>
            <th>A/B test</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr><td><a class="clickable" onclick="openAgent('pace-agent','Pace &amp; Pickup')">Pace &amp; Pickup</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v2.1</span> · 412 tokens</td><td>3d ago · Federico</td><td class="num">3</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('pace-agent','Pace &amp; Pickup')">Edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('parity-agent','Parity Watchdog')">Parity Watchdog</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v1.8</span> · 287 tokens</td><td>21d ago · Federico</td><td class="num">2</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('parity-agent','Parity Watchdog')">Edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('compset-agent','Comp Set Scanner')">Comp Set Scanner</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v1.4</span> · 356 tokens</td><td>14d ago · Federico</td><td class="num">2</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('compset-agent','Comp Set Scanner')">Edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('plan-agent','Plan Cleanup')">Plan Cleanup</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v1.2</span> · 224 tokens</td><td>30d ago · Federico</td><td class="num">1</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('plan-agent','Plan Cleanup')">Edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('forecast-agent','Forecast Engine')">Forecast Engine</a></td><td><span class="v" style="font-family:monospace;color:var(--text-faint);">v0.9 (paused)</span></td><td>60d ago · Setup</td><td class="num">2</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('forecast-agent','Forecast Engine')">Edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('cancel-agent','Cancellation Risk')">Cancellation Risk</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v1.6</span> · 318 tokens</td><td>9d ago · Federico</td><td class="num">2</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('cancel-agent','Cancellation Risk')">Edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('discovery-agent','Discovery')">Discovery</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v1.1</span> · 401 tokens</td><td>14d ago · Federico</td><td class="num">3</td><td><span class="rule-status warn">v1.0 vs v1.1 · 7d</span></td><td><button class="prompt-btn" onclick="openAgent('discovery-agent','Discovery')">Edit</button></td></tr>
          <tr style="background:#fdf8f1;"><td><a class="clickable" onclick="openAgent('tactical-agent','Tactical Detector')"><strong>Tactical Detector ★</strong></a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v3.2</span> · 687 tokens</td><td>2h ago · Federico</td><td class="num">5</td><td><span class="rule-status active">v3.1 vs v3.2 · 14d</span></td><td><button class="prompt-btn primary" onclick="openAgent('tactical-agent','Tactical Detector')">Open editor</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('composer-agent','Composer')">Composer</a></td><td><span class="v" style="font-family:monospace;color:var(--accent);">v2.4</span> · 542 tokens</td><td>5d ago · Federico</td><td class="num">4</td><td><span class="rule-status off">none</span></td><td><button class="prompt-btn" onclick="openAgent('composer-agent','Composer')">Edit</button></td></tr>
        </tbody>
      </table>

      <div style="margin-top:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn" style="font-size:11px;">Export all prompts (JSON)</button>
        <button class="btn" style="font-size:11px;">Import prompt template pack</button>
        <button class="btn" style="font-size:11px;">Reset to defaults</button>
        <span style="margin-left:auto;font-size:11px;color:var(--text-dim);">Tip: open the <strong>Tactical Detector</strong> first — it's the most complex prompt and the one most worth tuning</span>
      </div>

    </div>
  </div>

  <!-- ============= ACTION GUARDRAILS (revenue-specific) ============= -->
  <div class="gr-layer">
    <div class="gr-layer-header" onclick="toggleLayer(this)">
      <div class="gr-layer-title"><span class="gr-layer-num">1</span>Action guardrails · what can revenue agents do?</div>
      <div class="gr-layer-meta">7 rules · 1 warning</div>
    </div>
    <div class="gr-layer-body">

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Max rate change per day</div>
          <div class="gr-rule-desc">Agent cannot recommend rate changes &gt; this % up or down vs current BAR in a single day.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="12">
          <span class="gr-unit">%</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Max rate change per week</div>
          <div class="gr-rule-desc">Cumulative weekly cap to avoid rate volatility.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="20">
          <span class="gr-unit">%</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Hard rate floor (per room type)</div>
          <div class="gr-rule-desc">Absolute price floor. Agents will never propose below these regardless of demand.</div>
        </div>
        <div class="gr-rule-control">
          <button class="btn" style="font-size:10px;padding:4px 10px;">9 floors set</button>
          <a class="clickable" style="font-size:11px;">edit</a>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Hard rate ceiling (per room type)</div>
          <div class="gr-rule-desc">Absolute price ceiling. Useful for brand positioning · prevents runaway pricing on peak demand.</div>
        </div>
        <div class="gr-rule-control">
          <button class="btn" style="font-size:10px;padding:4px 10px;">9 ceilings set</button>
          <a class="clickable" style="font-size:11px;">edit</a>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Inventory restriction cap</div>
          <div class="gr-rule-desc">Max % of inventory that can be restricted (CTA / stop-sell / min-stay) at once across all agents.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="30">
          <span class="gr-unit">%</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Blackout dates · no auto-changes</div>
          <div class="gr-rule-desc">Agents will not propose any rate, restriction, or promo changes on these dates.</div>
        </div>
        <div class="gr-rule-control">
          <span class="rule-status active">5 dates</span>
        </div>
      </div>

      <div style="padding:8px 0 0;">
        <span class="blackout-tag">Songkran · 13-16 Apr 2026<span class="x">×</span></span>
        <span class="blackout-tag">LP Boat Racing · 24-27 Sep 2026<span class="x">×</span></span>
        <span class="blackout-tag">That Luang Festival · 14-16 Nov 2026<span class="x">×</span></span>
        <span class="blackout-tag">NYE · 28 Dec 2026 - 2 Jan 2027<span class="x">×</span></span>
        <span class="blackout-tag">Lao NY · 13-16 Apr 2027<span class="x">×</span></span>
        <button class="btn" style="font-size:10px;padding:3px 10px;">+ Add blackout</button>
      </div>

      <div class="gr-rule" style="margin-top:14px;border-top:1px solid var(--border);">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Channel-specific frequency caps</div>
          <div class="gr-rule-desc">Limit how often agents can use specific tactics. e.g. BDC Visibility Booster max 2x/month.</div>
        </div>
        <div class="gr-rule-control">
          <button class="btn" style="font-size:10px;padding:4px 10px;">12 caps set</button>
          <a class="clickable" style="font-size:11px;">edit</a>
          <span class="rule-status warn">1 warning</span>
        </div>
      </div>

    </div>
  </div>

  <!-- ============= BRAND / STRATEGY (revenue-specific) ============= -->
  <div class="gr-layer">
    <div class="gr-layer-header" onclick="toggleLayer(this)">
      <div class="gr-layer-title"><span class="gr-layer-num">2</span>Brand &amp; strategy guardrails · don't break positioning</div>
      <div class="gr-layer-meta">6 rules</div>
    </div>
    <div class="gr-layer-body">

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Max discount on Suite category</div>
          <div class="gr-rule-desc">Brand-protection floor. No more aggressive than this on premium rooms.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="12">
          <span class="gr-unit">%</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Max discount on Glamping</div>
          <div class="gr-rule-desc">Different category, different rules.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="20">
          <span class="gr-unit">%</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">No flash sales N days before peak dates</div>
          <div class="gr-rule-desc">Avoid signaling weak demand right before historically strong periods.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="14">
          <span class="gr-unit">days</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Comp set positioning floor</div>
          <div class="gr-rule-desc">Don't drop my rate more than X% below comp set median (avoid races to bottom).</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="-5">
          <span class="gr-unit">%</span>
          <span class="rule-status active">active</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Direct mix target floor</div>
          <div class="gr-rule-desc">If direct mix drops below this, agents prioritize direct-channel tactics.</div>
        </div>
        <div class="gr-rule-control">
          <input class="gr-input" type="number" value="25">
          <span class="gr-unit">%</span>
          <span class="rule-status warn">currently 21%</span>
        </div>
      </div>

      <div class="gr-rule">
        <div class="gr-rule-info">
          <div class="gr-rule-name">Minimum LOS by season</div>
          <div class="gr-rule-desc">Different LOS minimums apply in peak seasons.</div>
        </div>
        <div class="gr-rule-control">
          <button class="btn" style="font-size:10px;padding:4px 10px;">4 seasons set</button>
          <a class="clickable" style="font-size:11px;">edit</a>
        </div>
      </div>

    </div>
  </div>

  <!-- ============= PER-AGENT OVERRIDES (revenue agents) ============= -->
  <div class="gr-layer">
    <div class="gr-layer-header" onclick="toggleLayer(this)">
      <div class="gr-layer-title"><span class="gr-layer-num">3</span>Per-agent overrides · 9 revenue agents</div>
      <div class="gr-layer-meta">click any agent to open the full editor (prompt · knowledge · guardrail overrides · tools · output · test · metrics · history)</div>
    </div>
    <div class="gr-layer-body">

      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.6;">
        Each agent inherits global guardrails from <a href="/settings/agents" class="clickable" style="color:var(--accent);">Settings → Agent guardrails</a>. Override per agent only when needed (e.g. lower confidence floor for the Composer because it pre-filters with the Tactical Detector).
      </p>

      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Mode</th>
            <th class="num">Conf floor</th>
            <th class="num">Min impact</th>
            <th>Auto-execute</th>
            <th>Configure</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><a class="clickable" onclick="openAgent('pace-agent','Pace &amp; Pickup')">Pace &amp; Pickup</a></td><td><span class="pill green">Review</span></td><td class="num">75%</td><td class="num">$1,000</td><td><span class="rule-status off">manual</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('pace-agent','Pace &amp; Pickup')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('parity-agent','Parity Watchdog')">Parity Watchdog</a></td><td><span class="pill green">Auto T1</span></td><td class="num">90%</td><td class="num">$200</td><td><span class="rule-status active">auto resync</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('parity-agent','Parity Watchdog')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('compset-agent','Comp Set Scanner')">Comp Set Scanner</a></td><td><span class="pill green">Auto</span></td><td class="num">—</td><td class="num">—</td><td><span class="rule-status active">data only</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('compset-agent','Comp Set Scanner')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('plan-agent','Plan Cleanup')">Plan Cleanup</a></td><td><span class="pill green">Review</span></td><td class="num">100%</td><td class="num">—</td><td><span class="rule-status off">manual</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('plan-agent','Plan Cleanup')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('forecast-agent','Forecast Engine')">Forecast Engine</a></td><td><span class="pill amber">Paused</span></td><td class="num">—</td><td class="num">—</td><td>—</td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('forecast-agent','Forecast Engine')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('cancel-agent','Cancellation Risk')">Cancel Risk</a></td><td><span class="pill green">Review</span></td><td class="num">75%</td><td class="num">$500</td><td><span class="rule-status off">manual</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('cancel-agent','Cancellation Risk')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('discovery-agent','Discovery')">Discovery</a></td><td><span class="pill green">Review</span></td><td class="num">80%</td><td class="num">—</td><td><span class="rule-status off">manual</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('discovery-agent','Discovery')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('tactical-agent','Tactical Detector')">Tactical Detector</a></td><td><span class="pill green">Review</span></td><td class="num">70%</td><td class="num">$1,000</td><td><span class="rule-status off">manual</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('tactical-agent','Tactical Detector')">edit</button></td></tr>
          <tr><td><a class="clickable" onclick="openAgent('composer-agent','Composer')">Composer</a></td><td><span class="pill green">Review</span></td><td class="num">65%</td><td class="num">—</td><td><span class="rule-status off">drafts only</span></td><td><button class="btn" style="font-size:10px;padding:3px 8px;" onclick="openAgent('composer-agent','Composer')">edit</button></td></tr>
        </tbody>
      </table>

    </div>
  </div>

</div>`;
