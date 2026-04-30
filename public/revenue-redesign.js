
  function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.querySelectorAll('.subtab').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    // also update topbar title
    const titles = {
      'pulse': 'Revenue · <em>Pulse</em>',
      'pace': 'Revenue · <em>Pace &amp; Pickup</em>',
      'channels': 'Revenue · <em>Channels &amp; OTAs</em>',
      'rateplans': 'Revenue · <em>Rate Plans</em>',
      'pricing': 'Revenue · <em>Pricing</em>',
      'compset': 'Revenue · <em>Comp Set</em>',
      'agentsettings': 'Revenue · <em>Agent Guardrails</em>'
    };
    document.querySelector('.topbar h2').innerHTML = titles[name];
  }
  function toggleDrill(row) {
    const next = row.nextElementSibling;
    if (next && next.classList.contains('drill-row')) {
      next.style.display = next.style.display === 'none' ? 'table-row' : 'none';
    }
  }

  function showSource(name) {
    document.querySelectorAll('.source-content').forEach(el => el.classList.remove('active'));
    document.getElementById('source-' + name).classList.add('active');
    document.querySelectorAll('.source-tab').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
  }

  function setIndexSource(btn, source) {
    btn.parentElement.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const diffTable = document.getElementById('index-diff-table');
    if (source === 'diff') {
      diffTable.style.display = 'block';
    } else {
      diffTable.style.display = 'none';
    }
  }

  function setMode(el, mode) {
    el.parentElement.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    const log = document.getElementById('agent-log');
    const time = new Date().toLocaleTimeString('en-GB', {hour12: false});
    const entry = document.createElement('div');
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-warn">⚙</span> Mode → ${mode}`;
    log.insertBefore(entry, log.firstChild);
  }

  function toggleLayer(header) {
    const body = header.nextElementSibling;
    if (body.style.display === 'none') {
      body.style.display = 'block';
    } else {
      body.style.display = 'none';
    }
  }

  function handoffTo(specialist) {
    event.stopPropagation();
    const log = document.getElementById('agent-log');
    const time = new Date().toLocaleTimeString('en-GB', {hour12: false});
    const names = {
      campaign: 'Campaign Planner',
      social: 'Social Agent',
      email: 'Email Agent',
      content: 'Content Agent',
      rev: 'Revenue Manager',
      b2b: 'B2B/DMC Agent'
    };
    const entry = document.createElement('div');
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-warn">→</span> Brief sent to ${names[specialist] || specialist}`;
    log.insertBefore(entry, log.firstChild);
    openSpecialist(specialist);
  }

  function approveAndSend() {
    event.stopPropagation();
    const log = document.getElementById('agent-log');
    const time = new Date().toLocaleTimeString('en-GB', {hour12: false});
    const entry = document.createElement('div');
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-success">✓</span> 3 tactics approved · briefs dispatched`;
    log.insertBefore(entry, log.firstChild);
    openSpecialist('approval-summary');
  }

  function openSpecialist(specialist) {
    const map = {
      campaign: {
        title: 'Campaign Planner Agent',
        meta: 'Receives tactic brief · drafts media plan · pushes to ad platforms after approval',
        body: `
          <div class="design-note">
            Brief received from Tactical Composer · 12 min ago. Building media plan now.
          </div>
          <div class="modal-section-title">Draft media plan · EU Suite recovery</div>
          <table>
            <thead><tr><th>Channel</th><th>Audience</th><th>Creative</th><th>Spend</th><th>Period</th><th>KPI target</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Booking.com Visibility</td><td>DE/FR/UK Suite searchers</td><td>—</td><td class="num">+10% comm 14d</td><td>14d</td><td>+8 Suite bkg</td><td><span class="pill amber">draft · review</span></td></tr>
              <tr><td>Expedia TravelAds</td><td>DE/FR/UK · Suite</td><td>2 hero images · auto-generated</td><td class="num">$720</td><td>21d</td><td>+6 Suite bkg</td><td><span class="pill amber">draft · review</span></td></tr>
              <tr><td>Google Search</td><td>DE/FR/UK · luxury LP keywords</td><td>3 ad groups · 12 ads</td><td class="num">$1,330</td><td>21d</td><td>+10 Suite bkg</td><td><span class="pill amber">draft · review</span></td></tr>
              <tr><td>Meta IG retargeting</td><td>EU site visitors 60d</td><td>15s reel + carousel</td><td class="num">$440</td><td>14d</td><td>+4 bkg</td><td><span class="pill" style="border-color:var(--text-faint);color:var(--text-faint)">deferred</span></td></tr>
            </tbody>
          </table>
          <div class="modal-section-title">Auto-generated copy preview · Google Search ad</div>
          <div style="background:#f7f8fa;padding:14px;border-radius:4px;font-family:Georgia,serif;font-size:13px;border-left:3px solid var(--accent);">
            <strong>The Namkhan · Luxury Riverside Suites in Luang Prabang</strong><br>
            <span style="color:#1a73e8;font-size:12px;">www.thenamkhan.com/suites</span><br>
            Sustainably designed riverside suites overlooking the Mekong confluence. Free airport pickup for direct bookings. Best rate guarantee. View availability for autumn 2026.<br>
            <span style="font-size:10px;color:var(--text-faint)">CTAs: Check availability · See suites · Book direct</span>
          </div>
          <div class="modal-section-title">Approval needed</div>
          <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
            <li>Total spend: <strong>$2,490</strong> · within $3,000 monthly EU budget cap</li>
            <li>Expected revenue: <strong>+$12.7k</strong> · ROAS 5.1×</li>
            <li>Kill criteria: pause if CTR &lt; 0.8% after 5 days · auto-pause built in</li>
          </ul>
          <div class="modal-actions">
            <button class="btn btn-primary">Approve and launch</button>
            <button class="btn">Edit creative</button>
            <button class="btn">Send to human review</button>
            <button class="btn" style="margin-left:auto;color:var(--red);border-color:var(--red);">Reject</button>
          </div>
        `
      },
      social: {
        title: 'Social Agent',
        meta: 'Drafts IG/TikTok/FB content briefs · sources creator partnerships · schedules posts',
        body: `
          <div class="design-note">Brief received · drafting EU-targeted Instagram + TikTok content plan.</div>
          <div class="modal-section-title">Content briefs · 7d schedule</div>
          <table>
            <thead><tr><th>Day</th><th>Channel</th><th>Format</th><th>Hook</th><th>CTA</th></tr></thead>
            <tbody>
              <tr><td>D1</td><td>IG Reel</td><td>30s · drone over Mekong confluence</td><td>"The river you wake up to"</td><td>EU members get airport pickup</td></tr>
              <tr><td>D2</td><td>IG Carousel</td><td>10 photos · suite interiors</td><td>"What riverside actually means"</td><td>Direct book = 12% off May</td></tr>
              <tr><td>D3</td><td>TikTok</td><td>45s · breakfast at the Roots</td><td>"7am at the Namkhan"</td><td>Tag a friend who needs Laos</td></tr>
              <tr><td>D5</td><td>FB</td><td>Carousel post</td><td>EU heritage angle</td><td>EU exclusive offer</td></tr>
            </tbody>
          </table>
          <div class="modal-section-title">Creator outreach (proposed)</div>
          <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
            <li>3 micro-creators DE/FR/UK shortlisted · combined reach 220k</li>
            <li>Negotiated 2-night stay + €300 honorarium each = ~€1,200 total</li>
            <li>Deliverables: 1 reel + 3 stories + 1 carousel per creator</li>
          </ul>
          <div class="modal-actions">
            <button class="btn btn-primary">Approve content plan</button>
            <button class="btn">Edit briefs</button>
            <button class="btn">Approve creator partnerships only</button>
          </div>
        `
      },
      email: {
        title: 'Email Agent',
        meta: 'Builds segmented email campaigns · drafts copy · A/B tests subject lines',
        body: `
          <div class="design-note">Brief received · drafting EU NKMembers Suite flash promo.</div>
          <div class="modal-section-title">Campaign · "EU Members · Suite Flash"</div>
          <table>
            <tbody>
              <tr><td>Segment</td><td>EU NKMembers · Suite-history bookers · ~340 contacts</td></tr>
              <tr><td>Send time</td><td>Tuesday 10:00 CET</td></tr>
              <tr><td>Offer</td><td>12% off Suite · 7-day window · stay May-Aug</td></tr>
              <tr><td>Subject A</td><td>"A Suite, the river, and 12% off until Tuesday"</td></tr>
              <tr><td>Subject B</td><td>"Members-only: Riverview Suite, 12% off"</td></tr>
              <tr><td>Send strategy</td><td>50/50 A/B · winner sent to remainder after 4h</td></tr>
              <tr><td>Estimated open rate</td><td>32% (vs 28% list avg)</td></tr>
              <tr><td>Estimated bookings</td><td>6-9 · $2.1k revenue</td></tr>
            </tbody>
          </table>
          <div class="modal-actions">
            <button class="btn btn-primary">Schedule send</button>
            <button class="btn">Edit copy</button>
            <button class="btn">Preview</button>
          </div>
        `
      },
      content: {
        title: 'Content Agent',
        meta: 'Writes landing-page copy · blog posts · SEO content briefs',
        body: `<div class="design-note">Brief received · drafting EU-focused landing page + blog: "Why September is secretly the best time for Luang Prabang."</div><div class="modal-actions"><button class="btn btn-primary">Approve drafts</button></div>`
      },
      rev: {
        title: 'Revenue Manager (you)',
        meta: 'Restriction changes need human approval · pushes to Cloudbeds via API',
        body: `<div class="design-note">Restriction change requested: Drop min-stay 2→1 on weekday Glamping for 30 days. Will affect Riverfront + Explorer Glamping, Mon-Thu only.</div><table><tbody><tr><td>Affected nights</td><td class="num">~520 room-nights</td></tr><tr><td>Stay window</td><td>May 1 → May 31</td></tr><tr><td>Reversible</td><td>Yes · auto-revert after 30d</td></tr></tbody></table><div class="modal-actions"><button class="btn btn-primary">Apply to Cloudbeds</button><button class="btn">Modify dates</button><button class="btn">Reject</button></div>`
      },
      b2b: {
        title: 'B2B / DMC Agent',
        meta: 'Manages wholesale and DMC outreach · personalized rate sheets · contracted promos',
        body: `
          <div class="design-note">Brief received · DMC reactivation for US Sep-Nov gap.</div>
          <div class="modal-section-title">Outreach plan · 12 US DMC partners</div>
          <table>
            <thead><tr><th>DMC</th><th>Last bkg</th><th>Approach</th><th>Offer</th></tr></thead>
            <tbody>
              <tr><td>Audley Travel</td><td>4 mo ago</td><td>Personal email · GM signed</td><td>15% off Sep · 5-night min</td></tr>
              <tr><td>Remote Lands</td><td>6 mo ago</td><td>Personal call</td><td>12% Sep + 8% Nov</td></tr>
              <tr><td>Asia Transpacific</td><td>3 mo ago</td><td>Rate sheet email</td><td>10% Sep+Nov · Suite focus</td></tr>
              <tr><td>+ 9 more partners</td><td colspan="3">Tiered approach by historical volume</td></tr>
            </tbody>
          </table>
          <div class="modal-actions"><button class="btn btn-primary">Send outreach</button><button class="btn">Edit per-DMC offers</button></div>
        `
      },
      'approval-summary': {
        title: 'Approval Confirmed · 3 Tactics Dispatched',
        meta: 'Multi-channel response launched · tracking dashboard ready',
        body: `
          <div class="design-note">Tactic briefs sent. Each specialist agent will return drafts within 30 min for final human review before any external action (ad spend, email send, content publish).</div>
          <div class="modal-section-title">Dispatched briefs</div>
          <table>
            <thead><tr><th>Tactic</th><th>Specialist</th><th>Status</th><th>ETA draft ready</th></tr></thead>
            <tbody>
              <tr><td>BDC Visibility · EU Suite</td><td>Campaign Planner</td><td><span class="pill amber">drafting</span></td><td>~5 min</td></tr>
              <tr><td>Expedia TravelAds · EU</td><td>Campaign Planner</td><td><span class="pill amber">drafting</span></td><td>~8 min</td></tr>
              <tr><td>Google Ads resume</td><td>Campaign Planner</td><td><span class="pill amber">drafting</span></td><td>~12 min</td></tr>
            </tbody>
          </table>
          <div class="modal-section-title">Tracking</div>
          <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
            <li>Loop closure metric: EU Suite OTB +30d after launch</li>
            <li>Kill criteria embedded in each tactic · agents auto-pause if underperforming</li>
            <li>Daily report sent at 09:00 ICT showing tactic-by-tactic ROAS</li>
          </ul>
          <div class="modal-actions"><button class="btn btn-primary">Open tracking dashboard</button><button class="btn">Set up Slack alerts</button></div>
        `
      }
    };
    const spec = map[specialist] || map.campaign;
    modalTitle.textContent = spec.title;
    modalMeta.textContent = spec.meta;
    modalBody.innerHTML = spec.body;
    modalOverlay.classList.add('open');
  }

  // ============= TOOLTIP SYSTEM =============
  const tooltip = document.getElementById('tooltip');
  function showTooltip(evt, html) {
    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    moveTooltip(evt);
  }
  function moveTooltip(evt) {
    const x = evt.clientX;
    const y = evt.clientY;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const px = (x + tw + 20 > window.innerWidth) ? x - tw - 14 : x + 14;
    const py = (y + th + 20 > window.innerHeight) ? y - th - 14 : y + 14;
    tooltip.style.left = px + 'px';
    tooltip.style.top = py + 'px';
  }
  function hideTooltip() { tooltip.classList.remove('visible'); }

  // Bind hover behavior to all elements with data-tip
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) showTooltip(e, el.getAttribute('data-tip'));
  });
  document.addEventListener('mousemove', (e) => {
    if (tooltip.classList.contains('visible')) moveTooltip(e);
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) hideTooltip();
  });

  // ============= MODAL EXPAND SYSTEM =============
  const modalOverlay = document.getElementById('modal-overlay');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');

  function closeModal() {
    modalOverlay.classList.remove('open');
  }
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Chart definitions for expand views
  const charts = {
    'occ-by-roomtype': {
      title: 'Occupancy by Room Type',
      meta: 'Last 30 days · Actual vs Same Time Last Year vs Budget · USD',
      render: () => `
        <div class="modal-chart-wrap">
          <svg viewBox="0 0 1100 500">
            <line x1="80" y1="40" x2="1080" y2="40" stroke="#e5e7eb"/>
            <line x1="80" y1="130" x2="1080" y2="130" stroke="#e5e7eb"/>
            <line x1="80" y1="220" x2="1080" y2="220" stroke="#e5e7eb"/>
            <line x1="80" y1="310" x2="1080" y2="310" stroke="#e5e7eb"/>
            <line x1="80" y1="400" x2="1080" y2="400" stroke="#9ca3af"/>
            <text x="75" y="44" text-anchor="end" font-size="11" fill="#6b7280">100%</text>
            <text x="75" y="134" text-anchor="end" font-size="11" fill="#6b7280">75%</text>
            <text x="75" y="224" text-anchor="end" font-size="11" fill="#6b7280">50%</text>
            <text x="75" y="314" text-anchor="end" font-size="11" fill="#6b7280">25%</text>
            <text x="75" y="404" text-anchor="end" font-size="11" fill="#6b7280">0%</text>

            ${renderRoomBars()}
          </svg>
        </div>
        <div class="modal-section-title">Detail · 30 days</div>
        <table>
          <thead><tr><th>Room Type</th><th class="num">Inventory</th><th class="num">Actual Occ</th><th class="num">STLY</th><th class="num">Budget</th><th class="num">Δ vs Bgt</th><th class="num">Rooms Sold</th><th class="num">ADR</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Riverview Suite</td><td class="num">8</td><td class="num">48%</td><td class="num">32%</td><td class="num">55%</td><td class="num neg">-7pp</td><td class="num">115</td><td class="num">$251</td><td><span class="pill amber">monitor</span></td></tr>
            <tr><td>Riverfront Suite</td><td class="num">6</td><td class="num">42%</td><td class="num">38%</td><td class="num">50%</td><td class="num neg">-8pp</td><td class="num">76</td><td class="num">$294</td><td><span class="pill amber">monitor</span></td></tr>
            <tr><td>Riverfront Glamping</td><td class="num">10</td><td class="num">38%</td><td class="num">28%</td><td class="num">45%</td><td class="num neg">-7pp</td><td class="num">114</td><td class="num">$235</td><td><span class="pill green">on track</span></td></tr>
            <tr><td>Explorer Glamping</td><td class="num">8</td><td class="num">32%</td><td class="num">24%</td><td class="num">40%</td><td class="num neg">-8pp</td><td class="num">77</td><td class="num">$181</td><td><span class="pill amber">slow</span></td></tr>
            <tr><td>Art Deluxe Room</td><td class="num">6</td><td class="num">35%</td><td class="num">30%</td><td class="num">42%</td><td class="num neg">-7pp</td><td class="num">63</td><td class="num">$182</td><td><span class="pill green">on track</span></td></tr>
            <tr><td>Art Deluxe Suite</td><td class="num">4</td><td class="num">28%</td><td class="num">26%</td><td class="num">38%</td><td class="num neg">-10pp</td><td class="num">34</td><td class="num">$230</td><td><span class="pill amber">slow</span></td></tr>
            <tr style="background:#fef2f2"><td><strong>Art Deluxe Family</strong></td><td class="num">3</td><td class="num neg">22%</td><td class="num">18%</td><td class="num">35%</td><td class="num neg"><strong>-13pp</strong></td><td class="num">20</td><td class="num">$174</td><td><span class="pill red">🚨 underperform</span></td></tr>
            <tr><td>Sunset Namkhan Villa</td><td class="num">1</td><td class="num">18%</td><td class="num">12%</td><td class="num">25%</td><td class="num neg">-7pp</td><td class="num">5</td><td class="num">$387</td><td><span class="pill amber">low conv.</span></td></tr>
            <tr><td>Sunset LP Villa</td><td class="num">1</td><td class="num">15%</td><td class="num">8%</td><td class="num">22%</td><td class="num neg">-7pp</td><td class="num">5</td><td class="num">$358</td><td><span class="pill amber">low conv.</span></td></tr>
          </tbody>
        </table>
        <div class="modal-section-title">Insights</div>
        <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;color:var(--text);">
          <li><strong style="color:var(--red)">Art Deluxe Family</strong> is the only red flag — 13pp below budget. Action: rate adjustment + family promo bundle.</li>
          <li>All room types tracking <strong style="color:var(--green)">above STLY</strong> but <strong style="color:var(--red)">below budget</strong>. Budget may be too aggressive given current pace.</li>
          <li>Both Sunset Villas show low absolute occupancy but +6–7pp vs STLY. They have inventory of 1 each — sample size makes these volatile.</li>
        </ul>
        <div class="modal-actions">
          <button class="btn btn-primary">Export to CSV</button>
          <button class="btn">Compare vs prior period</button>
          <button class="btn">Drill by stay date</button>
        </div>
      `
    },
    'pace-curve-may': {
      title: 'Booking Pace Curve · May 2026',
      meta: 'OTB build over the 90 days before stay · vs STLY · vs Budget target',
      render: () => `
        <div class="modal-chart-wrap">
          <svg viewBox="0 0 1100 500">
            <line x1="80" y1="40" x2="1080" y2="40" stroke="#e5e7eb"/>
            <line x1="80" y1="130" x2="1080" y2="130" stroke="#e5e7eb"/>
            <line x1="80" y1="220" x2="1080" y2="220" stroke="#e5e7eb"/>
            <line x1="80" y1="310" x2="1080" y2="310" stroke="#e5e7eb"/>
            <line x1="80" y1="400" x2="1080" y2="400" stroke="#9ca3af"/>
            <text x="75" y="44" text-anchor="end" font-size="11" fill="#6b7280">800</text>
            <text x="75" y="134" text-anchor="end" font-size="11" fill="#6b7280">600</text>
            <text x="75" y="224" text-anchor="end" font-size="11" fill="#6b7280">400</text>
            <text x="75" y="314" text-anchor="end" font-size="11" fill="#6b7280">200</text>
            <text x="75" y="404" text-anchor="end" font-size="11" fill="#6b7280">0</text>

            <text x="100" y="430" font-size="11" fill="#6b7280">-90d</text>
            <text x="380" y="430" font-size="11" fill="#6b7280">-60d</text>
            <text x="660" y="430" font-size="11" fill="#6b7280">-30d</text>
            <text x="940" y="430" font-size="11" fill="#6b7280">stay date</text>

            <polyline points="100,388 200,372 300,350 400,320 500,272 600,222 700,162 800,108 900,55 970,45"
              fill="none" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="6,6"/>

            <polyline points="100,394 200,388 300,378 400,365 500,343 600,310 700,275 800,240 900,210 970,195"
              fill="none" stroke="#9ca3af" stroke-width="2.5"/>

            <polyline points="100,392 200,378 300,358 400,328 500,288 600,238 700,180 800,128 900,75 970,65"
              fill="none" stroke="#b8854a" stroke-width="3"/>

            ${renderPacePoints()}

            <line x1="970" y1="40" x2="970" y2="400" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,4"/>
            <text x="975" y="35" font-size="11" fill="#dc2626" font-weight="600">today</text>
          </svg>
        </div>
        <div class="modal-section-title">Pace milestones</div>
        <table>
          <thead><tr><th>Days before stay</th><th class="num">OTB</th><th class="num">STLY</th><th class="num">Budget</th><th class="num">Δ vs STLY</th><th class="num">Δ vs Budget</th><th class="num">Pickup velocity</th></tr></thead>
          <tbody>
            <tr><td>-90d</td><td class="num">22</td><td class="num">14</td><td class="num">25</td><td class="num pos">+8</td><td class="num neg">-3</td><td class="num">—</td></tr>
            <tr><td>-60d</td><td class="num">88</td><td class="num">42</td><td class="num">100</td><td class="num pos">+46</td><td class="num neg">-12</td><td class="num">+2.2/day</td></tr>
            <tr><td>-30d</td><td class="num">142</td><td class="num">78</td><td class="num">170</td><td class="num pos">+64</td><td class="num neg">-28</td><td class="num">+1.8/day</td></tr>
            <tr><td>-14d</td><td class="num">168</td><td class="num">96</td><td class="num">195</td><td class="num pos">+72</td><td class="num neg">-27</td><td class="num">+1.6/day</td></tr>
            <tr style="background:#fdf8f1"><td><strong>today</strong></td><td class="num"><strong>187</strong></td><td class="num">115</td><td class="num">220</td><td class="num pos"><strong>+72</strong></td><td class="num neg"><strong>-33</strong></td><td class="num">+1.4/day</td></tr>
          </tbody>
        </table>
        <div class="modal-section-title">Forecast & Recommendation</div>
        <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
          <li>At current pickup velocity (1.4/day) and 30 days remaining, projected month-end: <strong>~225 rn</strong> — would close gap to budget.</li>
          <li>Confidence: <strong style="color:var(--green)">82%</strong> based on last 5 May bookings curves.</li>
          <li>Recommended: <strong>tighten BAR +8% on weekends</strong> (May 9, 16, 23, 30) — high pickup signal not yet priced in.</li>
        </ul>
        <div class="modal-actions">
          <button class="btn btn-primary">Apply rate change</button>
          <button class="btn">Switch month</button>
          <button class="btn">Export</button>
        </div>
      `
    },
    'adr-occ-scatter': {
      title: 'ADR × Occupancy by Room Type',
      meta: 'Bubble size = revenue contribution · 30 days · USD',
      render: () => `
        <div class="modal-chart-wrap">
          <svg viewBox="0 0 1100 500">
            <line x1="80" y1="400" x2="1080" y2="400" stroke="#9ca3af"/>
            <line x1="80" y1="40" x2="80" y2="400" stroke="#9ca3af"/>
            <line x1="80" y1="130" x2="1080" y2="130" stroke="#e5e7eb" stroke-dasharray="3,3"/>
            <line x1="80" y1="220" x2="1080" y2="220" stroke="#e5e7eb" stroke-dasharray="3,3"/>
            <line x1="80" y1="310" x2="1080" y2="310" stroke="#e5e7eb" stroke-dasharray="3,3"/>
            <line x1="330" y1="40" x2="330" y2="400" stroke="#e5e7eb" stroke-dasharray="3,3"/>
            <line x1="580" y1="40" x2="580" y2="400" stroke="#e5e7eb" stroke-dasharray="3,3"/>
            <line x1="830" y1="40" x2="830" y2="400" stroke="#e5e7eb" stroke-dasharray="3,3"/>

            <text x="75" y="44" text-anchor="end" font-size="11" fill="#6b7280">$600</text>
            <text x="75" y="134" text-anchor="end" font-size="11" fill="#6b7280">$450</text>
            <text x="75" y="224" text-anchor="end" font-size="11" fill="#6b7280">$300</text>
            <text x="75" y="314" text-anchor="end" font-size="11" fill="#6b7280">$150</text>
            <text x="75" y="404" text-anchor="end" font-size="11" fill="#6b7280">$0</text>
            <text x="80" y="425" text-anchor="middle" font-size="11" fill="#6b7280">0%</text>
            <text x="330" y="425" text-anchor="middle" font-size="11" fill="#6b7280">25%</text>
            <text x="580" y="425" text-anchor="middle" font-size="11" fill="#6b7280">50%</text>
            <text x="830" y="425" text-anchor="middle" font-size="11" fill="#6b7280">75%</text>
            <text x="1080" y="425" text-anchor="middle" font-size="11" fill="#6b7280">100%</text>

            <text x="580" y="455" text-anchor="middle" font-size="12" fill="#374151" font-weight="600">Occupancy %</text>
            <text x="40" y="220" text-anchor="middle" font-size="12" fill="#374151" font-weight="600" transform="rotate(-90 40 220)">ADR</text>

            <text x="900" y="60" font-size="11" fill="#16a34a" font-weight="600">★ STAR · high occ + high ADR</text>
            <text x="100" y="60" font-size="11" fill="#dc2626" font-weight="600">⚠ DOG · low occ + high ADR</text>
            <text x="100" y="380" font-size="11" fill="#d97706" font-weight="600">DISCOUNTED · low occ + low ADR</text>
            <text x="900" y="380" font-size="11" fill="#2563eb" font-weight="600">CASH COW · high occ + low ADR</text>

            ${renderScatterBubbles()}
          </svg>
        </div>
        <div class="modal-section-title">Quadrant analysis</div>
        <table>
          <thead><tr><th>Room Type</th><th class="num">Occ %</th><th class="num">ADR</th><th class="num">Revenue 30d</th><th class="num">% of Total</th><th>Quadrant</th><th>Action</th></tr></thead>
          <tbody>
            <tr><td>Riverview Suite</td><td class="num">48%</td><td class="num">$251</td><td class="num">$28.9k</td><td class="num">29%</td><td><span class="pill green">★ Star</span></td><td>Yield up — low elasticity</td></tr>
            <tr><td>Riverfront Suite</td><td class="num">42%</td><td class="num">$294</td><td class="num">$22.3k</td><td class="num">23%</td><td><span class="pill" style="border-color:var(--blue);color:var(--blue)">Cash Cow</span></td><td>Hold rate · push direct</td></tr>
            <tr><td>Riverfront Glamping</td><td class="num">38%</td><td class="num">$235</td><td class="num">$26.8k</td><td class="num">27%</td><td><span class="pill" style="border-color:var(--blue);color:var(--blue)">Cash Cow</span></td><td>Volume play</td></tr>
            <tr><td>Explorer Glamping</td><td class="num">32%</td><td class="num">$181</td><td class="num">$13.9k</td><td class="num">14%</td><td><span class="pill amber">Discounted</span></td><td>Test +5% rate lift</td></tr>
            <tr><td>Art Deluxe Room</td><td class="num">35%</td><td class="num">$182</td><td class="num">$11.5k</td><td class="num">12%</td><td><span class="pill amber">Discounted</span></td><td>Bundle with F&B</td></tr>
            <tr><td>Art Deluxe Suite</td><td class="num">28%</td><td class="num">$230</td><td class="num">$7.8k</td><td class="num">8%</td><td><span class="pill amber">Discounted</span></td><td>Re-segment</td></tr>
            <tr style="background:#fef2f2"><td><strong>Art Deluxe Family</strong></td><td class="num neg">22%</td><td class="num">$174</td><td class="num">$3.5k</td><td class="num">4%</td><td><span class="pill amber">Discounted</span></td><td>🚨 Family promo + repositioning</td></tr>
            <tr style="background:#fef2f2"><td><strong>Sunset Namkhan Villa</strong></td><td class="num neg">18%</td><td class="num">$387</td><td class="num">$1.9k</td><td class="num">2%</td><td><span class="pill red">⚠ Dog</span></td><td>Drop rate or rebrand</td></tr>
            <tr style="background:#fef2f2"><td><strong>Sunset LP Villa</strong></td><td class="num neg">15%</td><td class="num">$358</td><td class="num">$1.6k</td><td class="num">2%</td><td><span class="pill red">⚠ Dog</span></td><td>Drop rate or rebrand</td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">Build elasticity test</button>
          <button class="btn">Export</button>
        </div>
      `
    },
    'pickup-velocity': {
      title: 'Pickup Velocity · Last 28 Days',
      meta: 'Daily new bookings for forward stays · 7-day moving average',
      render: () => `
        <div class="modal-chart-wrap">
          <svg viewBox="0 0 1100 500">
            <line x1="80" y1="80" x2="1080" y2="80" stroke="#e5e7eb"/>
            <line x1="80" y1="180" x2="1080" y2="180" stroke="#e5e7eb"/>
            <line x1="80" y1="280" x2="1080" y2="280" stroke="#e5e7eb"/>
            <line x1="80" y1="380" x2="1080" y2="380" stroke="#9ca3af"/>
            <text x="75" y="84" text-anchor="end" font-size="11" fill="#6b7280">15</text>
            <text x="75" y="184" text-anchor="end" font-size="11" fill="#6b7280">10</text>
            <text x="75" y="284" text-anchor="end" font-size="11" fill="#6b7280">5</text>
            <text x="75" y="384" text-anchor="end" font-size="11" fill="#6b7280">0</text>
            ${renderPickupBars()}
          </svg>
        </div>
        <div class="modal-section-title">Weekly summary</div>
        <table>
          <thead><tr><th>Week</th><th class="num">Bookings</th><th class="num">Roomnights</th><th class="num">Revenue</th><th class="num">Avg LOS</th><th class="num">vs Prior Wk</th></tr></thead>
          <tbody>
            <tr><td>4 weeks ago</td><td class="num">29</td><td class="num">82</td><td class="num">$17.4k</td><td class="num">2.8</td><td class="num">—</td></tr>
            <tr><td>3 weeks ago</td><td class="num">38</td><td class="num">108</td><td class="num">$23.1k</td><td class="num">2.9</td><td class="num pos">+31%</td></tr>
            <tr><td>2 weeks ago</td><td class="num">44</td><td class="num">128</td><td class="num">$28.6k</td><td class="num">2.9</td><td class="num pos">+16%</td></tr>
            <tr style="background:#f0fdf4"><td><strong>Last week</strong></td><td class="num"><strong>52</strong></td><td class="num">147</td><td class="num">$33.4k</td><td class="num">2.8</td><td class="num pos"><strong>+18%</strong></td></tr>
          </tbody>
        </table>
        <div class="modal-section-title">Diagnostic</div>
        <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
          <li>Pickup is <strong style="color:var(--green)">accelerating</strong> 4 weeks running — momentum signal is real, not noise.</li>
          <li>Booking.com contributed 58% of last-week pickup ($19.4k of $33.4k). Direct only 18%.</li>
          <li>If trend continues 2 more weeks → April month-end revenue exceeds budget by ~$8k.</li>
          <li><strong>Risk:</strong> high pickup at current rate suggests rates left on table. Test +5% on next pickup spike.</li>
        </ul>
        <div class="modal-actions">
          <button class="btn btn-primary">Trigger rate test</button>
          <button class="btn">Forecast next 7d</button>
        </div>
      `
    },
    'pace-12mo-bars': {
      title: 'Pace by Stay Month · Forward 12 Months',
      meta: 'OTB vs STLY vs Budget · Roomnights',
      render: () => `
        <div class="modal-chart-wrap">
          <svg viewBox="0 0 1100 500">
            <line x1="60" y1="40" x2="1080" y2="40" stroke="#e5e7eb"/>
            <line x1="60" y1="130" x2="1080" y2="130" stroke="#e5e7eb"/>
            <line x1="60" y1="220" x2="1080" y2="220" stroke="#e5e7eb"/>
            <line x1="60" y1="310" x2="1080" y2="310" stroke="#e5e7eb"/>
            <line x1="60" y1="400" x2="1080" y2="400" stroke="#9ca3af"/>
            <text x="55" y="44" text-anchor="end" font-size="11" fill="#6b7280">250</text>
            <text x="55" y="134" text-anchor="end" font-size="11" fill="#6b7280">200</text>
            <text x="55" y="224" text-anchor="end" font-size="11" fill="#6b7280">150</text>
            <text x="55" y="314" text-anchor="end" font-size="11" fill="#6b7280">100</text>
            <text x="55" y="404" text-anchor="end" font-size="11" fill="#6b7280">50</text>
            ${render12moBars()}
          </svg>
        </div>
        <div class="modal-section-title">Detail · forward 12 months</div>
        <table>
          <thead><tr><th>Month</th><th class="num">OTB Rn</th><th class="num">STLY</th><th class="num">Budget</th><th class="num">Δ STLY</th><th class="num">Δ Budget</th><th class="num">% to Bgt</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Apr 2026</td><td class="num">192</td><td class="num">18</td><td class="num">220</td><td class="num pos">+174</td><td class="num neg">-28</td><td class="num">87%</td><td><span class="pill green">strong</span></td></tr>
            <tr><td>May 2026</td><td class="num">187</td><td class="num">115</td><td class="num">220</td><td class="num pos">+72</td><td class="num neg">-33</td><td class="num">85%</td><td><span class="pill green">on pace</span></td></tr>
            <tr><td>Jun 2026</td><td class="num">39</td><td class="num">31</td><td class="num">150</td><td class="num pos">+8</td><td class="num neg">-111</td><td class="num">26%</td><td><span class="pill amber">slow</span></td></tr>
            <tr><td>Jul 2026</td><td class="num">34</td><td class="num">36</td><td class="num">130</td><td class="num neg">-2</td><td class="num neg">-96</td><td class="num">26%</td><td><span class="pill amber">watch</span></td></tr>
            <tr><td>Aug 2026</td><td class="num">29</td><td class="num">17</td><td class="num">110</td><td class="num pos">+12</td><td class="num neg">-81</td><td class="num">26%</td><td><span class="pill amber">watch</span></td></tr>
            <tr style="background:#fef2f2"><td><strong>Sep 2026</strong></td><td class="num neg">4</td><td class="num">93</td><td class="num">130</td><td class="num neg">-89</td><td class="num neg">-126</td><td class="num neg">3%</td><td><span class="pill red">🚨 critical</span></td></tr>
            <tr><td>Oct 2026</td><td class="num">18</td><td class="num">8</td><td class="num">180</td><td class="num pos">+10</td><td class="num neg">-162</td><td class="num">10%</td><td><span class="pill amber">slow</span></td></tr>
            <tr style="background:#fef2f2"><td><strong>Nov 2026</strong></td><td class="num neg">7</td><td class="num">14</td><td class="num">200</td><td class="num neg">-7</td><td class="num neg">-193</td><td class="num neg">4%</td><td><span class="pill red">at risk</span></td></tr>
            <tr><td>Dec 2026</td><td class="num">21</td><td class="num">29</td><td class="num">220</td><td class="num neg">-8</td><td class="num neg">-199</td><td class="num">10%</td><td><span class="pill amber">watch</span></td></tr>
            <tr><td>Jan 2027</td><td class="num">21</td><td class="num">13</td><td class="num">200</td><td class="num pos">+8</td><td class="num neg">-179</td><td class="num">11%</td><td><span class="pill green">on pace</span></td></tr>
            <tr><td>Feb 2027</td><td class="num">44</td><td class="num">0</td><td class="num">180</td><td class="num pos">+44</td><td class="num neg">-136</td><td class="num">24%</td><td><span class="pill green">on pace</span></td></tr>
            <tr><td>Mar 2027</td><td class="num">0</td><td class="num">0</td><td class="num">200</td><td class="num">—</td><td class="num">—</td><td class="num">0%</td><td><span class="pill">too early</span></td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">Launch promo · Sep+Nov</button>
          <button class="btn">Export</button>
        </div>
      `
    }
  };

  // ============= SVG generators (with data-tip on every element) =============
  function renderRoomBars() {
    const rooms = [
      {name:'Riverview Suite', label:'Riverview', x:120, occ:48, stly:32, bgt:55, sold:115, adr:251, rev:'$28.9k'},
      {name:'Riverfront Suite', label:'Riverfront S.', x:220, occ:42, stly:38, bgt:50, sold:76, adr:294, rev:'$22.3k'},
      {name:'Riverfront Glamping', label:'Riverfront G.', x:320, occ:38, stly:28, bgt:45, sold:114, adr:235, rev:'$26.8k'},
      {name:'Explorer Glamping', label:'Explorer', x:420, occ:32, stly:24, bgt:40, sold:77, adr:181, rev:'$13.9k'},
      {name:'Art Deluxe Room', label:'Art Dlx Rm', x:520, occ:35, stly:30, bgt:42, sold:63, adr:182, rev:'$11.5k'},
      {name:'Art Deluxe Suite', label:'Art Dlx S.', x:620, occ:28, stly:26, bgt:38, sold:34, adr:230, rev:'$7.8k'},
      {name:'Art Deluxe Family', label:'Art Family', x:720, occ:22, stly:18, bgt:35, sold:20, adr:174, rev:'$3.5k', risk:true},
      {name:'Sunset Namkhan Villa', label:'Sunset Nk', x:820, occ:18, stly:12, bgt:25, sold:5, adr:387, rev:'$1.9k'},
      {name:'Sunset LP Villa', label:'Sunset LP', x:920, occ:15, stly:8, bgt:22, sold:5, adr:358, rev:'$1.6k'}
    ];
    return rooms.map(r => {
      const yA = 400 - r.occ * 3.6;
      const yS = 400 - r.stly * 3.6;
      const yB = 400 - r.bgt * 3.6;
      const dStly = r.occ - r.stly;
      const dBgt = r.occ - r.bgt;
      const color = r.risk ? '#dc2626' : '#b8854a';
      const tip = (label, val) => buildTip(r.name, [
        ['Actual', r.occ + '%'],
        ['STLY', r.stly + '%'],
        ['Budget', r.bgt + '%'],
        ['vs STLY', (dStly>=0?'+':'') + dStly + 'pp', dStly>=0?'pos':'neg'],
        ['vs Budget', (dBgt>=0?'+':'') + dBgt + 'pp', dBgt>=0?'pos':'neg'],
        ['Sold', r.sold + ' rn'],
        ['ADR', '$' + r.adr],
        ['Revenue', r.rev]
      ], label);
      return `
        <rect x="${r.x}" y="${yA}" width="22" height="${400-yA}" fill="${color}" data-tip='${tip('Actual ' + r.occ + '%')}'/>
        <rect x="${r.x+24}" y="${yS}" width="22" height="${400-yS}" fill="#9ca3af" data-tip='${tip('STLY ' + r.stly + '%')}'/>
        <rect x="${r.x+48}" y="${yB}" width="22" height="${400-yB}" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,4" data-tip='${tip('Budget ' + r.bgt + '%')}'/>
        <text x="${r.x+35}" y="425" text-anchor="middle" font-size="11" fill="${r.risk?'#dc2626':'#374151'}">${r.label}${r.risk?' ⚠':''}</text>
      `;
    }).join('');
  }

  function renderPacePoints() {
    // points for OTB curve, hover = milestone tooltips
    const pts = [
      {x:100, y:392, days:90, otb:8, stly:6, bgt:10},
      {x:200, y:378, days:75, otb:35, stly:22, bgt:50},
      {x:300, y:358, days:60, otb:88, stly:42, bgt:100},
      {x:400, y:328, days:45, otb:120, stly:60, bgt:140},
      {x:500, y:288, days:30, otb:142, stly:78, bgt:170},
      {x:600, y:238, days:21, otb:158, stly:88, bgt:190},
      {x:700, y:180, days:14, otb:168, stly:96, bgt:195},
      {x:800, y:128, days:7, otb:178, stly:108, bgt:210},
      {x:900, y:75, days:3, otb:184, stly:113, bgt:218},
      {x:970, y:65, days:0, otb:187, stly:115, bgt:220}
    ];
    return pts.map(p => {
      const tip = buildTip(`-${p.days}d before stay`, [
        ['OTB', p.otb + ' rn'],
        ['STLY', p.stly + ' rn'],
        ['Budget', p.bgt + ' rn'],
        ['vs STLY', '+' + (p.otb-p.stly), 'pos'],
        ['vs Budget', (p.otb-p.bgt), p.otb-p.bgt>=0?'pos':'neg']
      ]);
      return `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#b8854a" stroke="#fff" stroke-width="2" data-tip='${tip}'/>`;
    }).join('');
  }

  function renderScatterBubbles() {
    const rooms = [
      {name:'Sunset LP Villa', occ:15, adr:358, rev:1600, color:'#dc2626', q:'Dog'},
      {name:'Sunset Namkhan Villa', occ:18, adr:387, rev:1900, color:'#dc2626', q:'Dog'},
      {name:'Riverfront Suite', occ:42, adr:294, rev:22300, color:'#2563eb', q:'Cash Cow'},
      {name:'Riverview Suite', occ:48, adr:251, rev:28900, color:'#16a34a', q:'Star'},
      {name:'Riverfront Glamping', occ:38, adr:235, rev:26800, color:'#2563eb', q:'Cash Cow'},
      {name:'Art Deluxe Room', occ:35, adr:182, rev:11500, color:'#d97706', q:'Discounted'},
      {name:'Art Deluxe Suite', occ:28, adr:230, rev:7800, color:'#d97706', q:'Discounted'},
      {name:'Explorer Glamping', occ:32, adr:181, rev:13900, color:'#d97706', q:'Discounted'},
      {name:'Art Deluxe Family', occ:22, adr:174, rev:3500, color:'#dc2626', q:'Discounted', risk:true}
    ];
    return rooms.map(r => {
      const cx = 80 + r.occ * 10;
      const cy = 400 - (r.adr / 600) * 360;
      const radius = Math.max(8, Math.min(40, Math.sqrt(r.rev) / 4));
      const tip = buildTip(r.name, [
        ['Occupancy', r.occ + '%'],
        ['ADR', '$' + r.adr],
        ['Revenue 30d', '$' + (r.rev/1000).toFixed(1) + 'k'],
        ['Quadrant', r.q]
      ], r.risk ? '🚨 underperforming' : null);
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${r.color}" fill-opacity="0.4" stroke="${r.color}" stroke-width="2" data-tip='${tip}'/>
              <text x="${cx + radius + 4}" y="${cy + 4}" font-size="11" fill="#374151">${r.name}</text>`;
    }).join('');
  }

  function renderPickupBars() {
    const data = [3,5,2,7,4,9,5,7,11,5,13,15,9,7,11,17,15,19,13,15,22,17,19,15,19,25,23,0]; // 28 days, last is partial
    const colors = data.map((v,i) => i < 7 ? '#9ca3af' : (i >= 26 ? '#16a34a' : '#b8854a'));
    return data.map((v, i) => {
      if (v === 0) return '';
      const x = 100 + i * 35;
      const h = v * 20;
      const y = 380 - h;
      const dayLabel = `${28-i} days ago`;
      const tip = buildTip(dayLabel, [
        ['Bookings', v],
        ['Roomnights', Math.round(v * 2.8) + ' rn'],
        ['Revenue', '$' + (v * 600).toLocaleString()],
        ['Top channel', i % 3 === 0 ? 'Direct' : 'Booking.com']
      ]);
      return `<rect x="${x}" y="${y}" width="28" height="${h}" fill="${colors[i]}" data-tip='${tip}'/>`;
    }).join('');
  }

  function render12moBars() {
    const months = [
      {m:'Apr 2026', otb:192, stly:18, bgt:220, x:80},
      {m:'May 2026', otb:187, stly:115, bgt:220, x:160},
      {m:'Jun 2026', otb:39, stly:31, bgt:150, x:240},
      {m:'Jul 2026', otb:34, stly:36, bgt:130, x:320},
      {m:'Aug 2026', otb:29, stly:17, bgt:110, x:400},
      {m:'Sep 2026', otb:4, stly:93, bgt:130, x:480, risk:true},
      {m:'Oct 2026', otb:18, stly:8, bgt:180, x:560},
      {m:'Nov 2026', otb:7, stly:14, bgt:200, x:640, risk:true},
      {m:'Dec 2026', otb:21, stly:29, bgt:220, x:720},
      {m:'Jan 2027', otb:21, stly:13, bgt:200, x:800},
      {m:'Feb 2027', otb:44, stly:0, bgt:180, x:880},
      {m:'Mar 2027', otb:0, stly:0, bgt:200, x:960}
    ];
    return months.map(mo => {
      const yO = 400 - mo.otb * 1.44;
      const yS = 400 - mo.stly * 1.44;
      const yB = 400 - mo.bgt * 1.44;
      const dStly = mo.otb - mo.stly;
      const dBgt = mo.otb - mo.bgt;
      const color = mo.risk ? '#dc2626' : '#b8854a';
      const tip = buildTip(mo.m, [
        ['OTB', mo.otb + ' rn'],
        ['STLY', mo.stly + ' rn'],
        ['Budget', mo.bgt + ' rn'],
        ['Δ STLY', (dStly>=0?'+':'') + dStly, dStly>=0?'pos':'neg'],
        ['Δ Budget', (dBgt>=0?'+':'') + dBgt, dBgt>=0?'pos':'neg'],
        ['% to Bgt', Math.round(mo.otb/mo.bgt*100) + '%']
      ], mo.risk ? '🚨 off-pace · action needed' : null);
      return `
        <rect x="${mo.x}" y="${yO}" width="20" height="${400-yO}" fill="${color}" data-tip='${tip}'/>
        <rect x="${mo.x+22}" y="${yS}" width="20" height="${400-yS}" fill="#9ca3af" data-tip='${tip}'/>
        <rect x="${mo.x+44}" y="${yB}" width="20" height="${400-yB}" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,4" data-tip='${tip}'/>
        <text x="${mo.x+32}" y="425" text-anchor="middle" font-size="11" fill="${mo.risk?'#dc2626':'#374151'}">${mo.m.split(' ')[0]}${mo.risk?' ⚠':''}</text>
      `;
    }).join('');
  }

  function buildTip(title, rows, note) {
    const escAttr = (s) => String(s).replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    let html = `<div class="tt-title">${title}</div>`;
    rows.forEach(r => {
      const cls = r[2] ? ` tt-${r[2]}` : '';
      html += `<div class="tt-row"><span class="lbl">${r[0]}</span><span class="val${cls}">${r[1]}</span></div>`;
    });
    if (note) html += `<div class="tt-note">${note}</div>`;
    return escAttr(html);
  }

  function openChart(chartId) {
    const chart = charts[chartId];
    if (!chart) return;
    modalTitle.textContent = chart.title;
    modalMeta.textContent = chart.meta;
    modalBody.innerHTML = chart.render();
    modalOverlay.classList.add('open');
  }

  // ============= AGENT FUNCTIONS =============
  function toggleDock() {
    const dock = document.getElementById('agent-dock');
    const toggle = document.getElementById('dock-toggle');
    dock.classList.toggle('collapsed');
    toggle.textContent = dock.classList.contains('collapsed') ? '+' : '−';
  }

  function fireAgent(name) {
    event.stopPropagation();
    const log = document.getElementById('agent-log');
    const time = new Date().toLocaleTimeString('en-GB', {hour12: false});
    const entry = document.createElement('div');
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-warn">⏳</span> ${name} agent · running...`;
    log.insertBefore(entry, log.firstChild);
    setTimeout(() => {
      const findings = Math.floor(Math.random() * 4) + 1;
      entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-success">✓</span> ${name} agent · ${findings} findings`;
    }, 1200);
  }

  function fireAllAgents() {
    ['pace','parity','compset','plans','cancel'].forEach((a, i) => {
      setTimeout(() => fireAgent(a), i * 300);
    });
  }

  function fireCompsetAgent() {
    fireAgent('compset');
  }

  function pauseAgent(btn) {
    event.stopPropagation();
    btn.classList.toggle('active');
    btn.textContent = btn.classList.contains('active') ? '▶' : '⏸';
  }

  // Agent modal definitions
  const agentDetails = {
    'pace-agent': {
      title: 'Pace & Pickup Agent',
      meta: 'Monitors OTB build vs STLY and budget · fires findings when pace deviates from forecast band',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--green)">Running</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">every 15 min</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v2.1</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$8.40</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v2.1</div>
        <div class="prompt-editor-toolbar" style="border-radius:6px 6px 0 0;">
          <div class="left">
            <span class="prompt-tab active">📝 Prompt</span>
            <span class="prompt-tab">🧩 Variables (8)</span>
            <span class="prompt-tab">📚 Knowledge (3)</span>
            <span class="prompt-tab">🧪 Test</span>
            <span class="prompt-tab">🕘 History</span>
          </div>
          <span class="prompt-version">v2.1 · 3d ago</span>
        </div>
        <div class="prompt-editor-wrap" style="margin-top:0;border-radius:0 0 6px 6px;border-top:none;">
          <textarea class="prompt-textarea" style="min-height:200px;">You are the Pace & Pickup agent for The Namkhan in {{property.city}}.

# Your role
Monitor OTB build velocity against STLY and budget every 15 min. Detect deviations from forecast band. Surface findings — do NOT propose rate or restriction changes (the Composer + RM own that).

# Decision rules
1. For each future stay-month within {{pace.horizon_months}}: compare OTB to STLY at same point in lead-time
2. Fire finding if |deviation| > {{pace.deviation_threshold}} AND |$ impact| > {{detection.min_impact}}
3. Break down by segment (Direct/OTA/Wholesale/Group) when global deviation < threshold but segment-level exceeds it
4. Compute pickup velocity: 7d and 28d rolling pickup vs STLY pickup at same lead-time
5. Distinguish "pace gap" (slow build) from "pace surge" (fast build) — both warrant attention

# Hard constraints
- NEVER fire on dates in {{knowledge.blackout_calendar}}
- NEVER fire below confidence floor {{detection.confidence_floor}}
- Cooldown: {{detection.cooldown_hours}}h per dimension

# Output (JSON)
{ "type": "pace_finding", "stay_month": "...", "deviation_pct": ..., "impact_usd": ..., "segment_breakdown": [...], "velocity_7d": ..., "velocity_28d": ..., "diagnosis": "<≤200 char>" }

# Tone
Diagnostic. Surface the gap, explain the pattern, hand off to Composer for action.</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">412 tokens · est. cost per run: $0.007</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test</button>
            <button class="prompt-btn">↶ Discard</button>
          </div>
        </div>

        <div class="modal-section-title">Configuration</div>
        <table>
          <thead><tr><th>Parameter</th><th>Current value</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td>Pace deviation threshold</td><td class="num">±15%</td><td>Trigger alert if OTB deviates this much from STLY forecast band</td></tr>
            <tr><td>Risk window</td><td class="num">forward 18 months</td><td>How far ahead to monitor</td></tr>
            <tr><td>Min impact</td><td class="num">$1,000</td><td>Don't surface findings below this revenue impact</td></tr>
            <tr><td>Segment breakdown</td><td>enabled</td><td>Analyze pace by Direct/OTA/Wholesale/Group separately</td></tr>
            <tr><td>Auto-action allowed</td><td><span class="pill red">disabled</span></td><td>Whether agent can push rate changes without human approval</td></tr>
          </tbody>
        </table>
        <div class="modal-section-title">Recent runs</div>
        <table>
          <thead><tr><th>Timestamp</th><th>Duration</th><th>Findings</th><th>Top finding</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>16:49:12</td><td>3.2s</td><td class="num">3</td><td>Forward pace +222rn vs STLY</td><td><span class="pill green">success</span></td></tr>
            <tr><td>16:34:08</td><td>3.1s</td><td class="num">3</td><td>Forward pace +220rn vs STLY</td><td><span class="pill green">success</span></td></tr>
            <tr><td>16:19:01</td><td>3.4s</td><td class="num">2</td><td>Sep 2026 -89rn STLY gap</td><td><span class="pill green">success</span></td></tr>
            <tr><td>16:04:55</td><td>2.9s</td><td class="num">2</td><td>Sep 2026 -89rn STLY gap</td><td><span class="pill green">success</span></td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">⚡ Fire now</button>
          <button class="btn">Edit config</button>
          <button class="btn">View logs</button>
          <button class="btn" style="margin-left:auto;color:var(--red);border-color:var(--red);">Pause agent</button>
        </div>
      `
    },
    'parity-agent': {
      title: 'Parity Watchdog',
      meta: 'Monitors rate parity across Booking.com, Expedia, direct · alerts on breaches',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--green)">Running</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">every 5 min</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v1.8</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$12.30</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v1.8</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:160px;">You are the Parity Watchdog for The Namkhan in {{property.city}}.

# Your role
Compare direct rates against OTA-published rates every 5 min. Detect rate parity breaches. In Tier-1 mode (post-pilot), auto-resync minor breaches; in Review mode, surface for human approval.

# Decision rules
1. For each (room × date × channel): pull direct rate from Cloudbeds, compare to channel-published rate
2. Flag breach if |Δ| > {{parity.tolerance_pct}} (default 2%)
3. Auto-resync allowed ONLY if: Tier-1 mode + impact < $2,000 + confidence ≥ 85%
4. Otherwise: surface as alert, await human approval

# Hard constraints
- NEVER auto-resync during pilot phase (first 90d)
- NEVER auto-resync on dates in {{knowledge.blackout_calendar}}
- Cooldown: 1h per room×date after a resync

# Output (JSON)
{ "type": "parity_breach", "date": "...", "room": "...", "direct_rate": ..., "channel_rate": ..., "delta_pct": ..., "channel": "...", "auto_resync_eligible": bool, "suggested_action": "..." }</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">287 tokens</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test</button>
          </div>
        </div>

        <div class="modal-section-title">Active breaches</div>
        <table>
          <thead><tr><th>Date</th><th>Room</th><th>Direct</th><th>Channel</th><th>Δ %</th><th>Detected</th></tr></thead>
          <tbody>
            <tr style="background:#fef2f2"><td>04 May 2026</td><td>Riverview Suite</td><td class="num">$245</td><td>Booking.com $215</td><td class="num neg">-12%</td><td>14 min ago</td></tr>
            <tr style="background:#fef2f2"><td>07 May 2026</td><td>Riverview Suite</td><td class="num">$245</td><td>Booking.com $220</td><td class="num neg">-10%</td><td>14 min ago</td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">Auto-resync rates</button>
          <button class="btn">Investigate root cause</button>
        </div>
      `
    },
    'compset-agent': {
      title: 'Comp Set Scanner',
      meta: 'Scrapes Booking.com hourly for 7 LP competitors · feeds the Comp Set tab',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--green)">Running</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">hourly</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v1.4</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$24.00</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v1.4</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:180px;">You are the Comp Set Scanner for The Namkhan in {{property.city}}.

# Your role
Every hour, fetch entry-level room rates from {{compset.source}} for the {{compset.tracked_count}} properties in the Manual Strategic comp set ({{knowledge.manual_compset}}). Detect rate moves, score changes, position rank shifts. Feed the Comp Set tab.

# Decision rules
1. For each tracked property: pull rates for next {{compset.forward_days}} days (default 14), entry-level room only
2. Currency-normalize to USD using daily ECB rate
3. Detect "rate move" if Δ > {{compset.move_threshold}}% within 24h or {{compset.move_threshold_7d}}% within 7d
4. Detect "score change" if review score changes ≥ 0.1 or new reviews suddenly drop in volume
5. Compute property rank against my rate by date

# Hard constraints
- DO NOT scrape outside published rate data (no inventory probing, no fake bookings)
- Respect robots.txt and rate-limit your scrapes
- If scrape fails for >2h on any property: surface as data-quality alert, do NOT pause whole agent

# Output (JSON)
{ "type": "compset_event", "event": "rate_move|score_change|rank_shift", "property": "...", "current": ..., "previous": ..., "delta": ..., "alert_priority": "..." }</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">356 tokens</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test</button>
          </div>
        </div>

        <div class="modal-section-title">Tracked properties</div>
        <table>
          <thead><tr><th>Property</th><th>Stars</th><th>Last scrape</th><th>Coverage</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Rosewood Luang Prabang</td><td class="num">5</td><td>12 min ago</td><td>14d ahead · 3 room types</td><td><span class="pill green">healthy</span></td></tr>
            <tr><td>Avani+ Luang Prabang</td><td class="num">5</td><td>12 min ago</td><td>14d ahead · 4 room types</td><td><span class="pill green">healthy</span></td></tr>
            <tr><td>Sofitel Luang Prabang</td><td class="num">5</td><td>12 min ago</td><td>14d ahead · 5 room types</td><td><span class="pill green">healthy</span></td></tr>
            <tr><td>Mekong Estate</td><td class="num">4</td><td>12 min ago</td><td>14d ahead · 3 room types</td><td><span class="pill green">healthy</span></td></tr>
            <tr><td>3 Nagas Luang Prabang</td><td class="num">4</td><td>12 min ago</td><td>14d ahead · 2 room types</td><td><span class="pill green">healthy</span></td></tr>
            <tr><td>Satri House</td><td class="num">4</td><td>12 min ago</td><td>14d ahead · 3 room types</td><td><span class="pill green">healthy</span></td></tr>
            <tr><td>Maison Souvannaphoum</td><td class="num">4</td><td>1h ago</td><td>14d ahead · 2 room types</td><td><span class="pill amber">slow</span></td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">⚡ Refresh now</button>
          <button class="btn">Add property</button>
          <button class="btn">Edit thresholds</button>
        </div>
      `
    },
    'plan-agent': {
      title: 'Rate Plan Cleanup',
      meta: 'Daily scan to identify dormant or underperforming rate plans · proposes retirements',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value">Idle</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">daily 02:00</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v1.2</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$3.10</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v1.2</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:160px;">You are the Rate Plan Cleanup agent for The Namkhan.

# Your role
Once a day at 02:00 LAK, score every active rate plan in Cloudbeds. Identify dormant plans. Propose retirements. NEVER retire — only propose.

# Scoring rules
For each rate plan, compute health_score (0-100):
- Bookings last 180d (40 pts) — 0 bookings = 0 pts
- Revenue last 180d (30 pts) — &lt;$500 = 0 pts
- Channel coverage (15 pts) — unmapped to active channels = 0 pts
- Recency of creation (10 pts) — &lt; 90d old = full pts (protected)
- Special segment lock (5 pts) — UWC, Hilton, Group locked from retirement = full pts

Plans with score &lt; {{plan.retire_threshold}} (default 25) are retire candidates.

# Hard constraints
- NEVER retire: any plan in {{knowledge.protected_plans}} list (Hilton, UWC, Group, BAR variants)
- NEVER retire plans &lt; 90 days old
- Retirement always requires human approval (writes to Cloudbeds via patchRate disable)

# Output (JSON)
{ "candidates": [{ "plan_id": "...", "plan_name": "...", "score": ..., "last_booking": "...", "rev_180d": ..., "rationale": "..." }] }</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">224 tokens</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test</button>
          </div>
        </div>

        <div class="modal-section-title">Scoring rules</div>
        <table>
          <thead><tr><th>Score factor</th><th>Weight</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td>Bookings 180d</td><td>40%</td><td>Plans with 0 bookings score 0</td></tr>
            <tr><td>Revenue 180d</td><td>30%</td><td>Below $500 = retire candidate</td></tr>
            <tr><td>Channel coverage</td><td>15%</td><td>Plans not mapped to active channels deprioritized</td></tr>
            <tr><td>Recency of creation</td><td>10%</td><td>Plans &lt; 90d old protected from retirement</td></tr>
            <tr><td>Special segment lock</td><td>5%</td><td>UWC, Hilton, Group locked from retirement</td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">⚡ Fire now</button>
          <button class="btn">Open kill list (41)</button>
        </div>
      `
    },
    'forecast-agent': {
      title: 'Forecast Engine',
      meta: 'ML-based revenue forecast · currently paused waiting for 90d training data',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--amber)">Paused</div></div>
          <div class="kpi"><div class="kpi-label">Reason</div><div class="kpi-value" style="font-size:14px">needs 90d</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v0.9</div></div>
          <div class="kpi"><div class="kpi-label">ETA active</div><div class="kpi-value" style="font-size:14px">~48 days</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v0.9 (paused — will be tuned before activation)</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:140px;">You are the Forecast Engine for The Namkhan.

# Your role
Produce daily revenue forecasts at +30, +60, +90 days with 80% confidence intervals. Wait for {{forecast.min_history_days}} days of clean Cloudbeds data before activating. Currently {{forecast.current_history_days}} / {{forecast.min_history_days}}.

# Decision rules (when active)
1. Train on rolling {{forecast.min_history_days}}d Cloudbeds reservations + STLY equivalent
2. Predict using gradient-boosted model with features: lead-time distribution, segment mix, day-of-week, season, blackout proximity, comp set price moves
3. Always emit confidence intervals — never a point estimate alone
4. Refresh nightly at 03:00 LAK

# Hard constraints
- DO NOT activate before {{forecast.min_history_days}}d history reached
- DO NOT extrapolate beyond 18 months forward (training data won't support it)
- If model error >15% on rolling 30d backtest: auto-pause, alert {{notify.data_quality}}

# Output (JSON)
{ "forecast_date": "...", "horizon_30d": { "revenue": ..., "ci_low": ..., "ci_high": ... }, "horizon_60d": {...}, "horizon_90d": {...}, "confidence": ... }</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">v0.9 · template only · 387 tokens · paused</span>
            <button class="prompt-btn primary">💾 Save draft</button>
            <button class="prompt-btn">🧪 Backtest with current 42d</button>
          </div>
        </div>

        <div class="modal-section-title">Why paused</div>
        <p style="font-size:12px;line-height:1.8;color:var(--text);">
          The forecast model needs at least 90 days of clean Cloudbeds data to produce reliable predictions with reasonable confidence intervals. Currently 42 days available since BI integration started. Rather than show a low-confidence forecast that operators may misinterpret, the agent stays paused. Will auto-resume in ~48 days.
        </p>
        <div class="modal-section-title">Once active, will produce</div>
        <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
          <li>Daily revenue forecast +30 / +60 / +90 days with 80% confidence interval</li>
          <li>Pace deviation early warning (e.g. "May 2026 will close 12% below budget at current velocity")</li>
          <li>Optimal rate suggestions per room type per date</li>
          <li>Cancellation forecast by segment</li>
        </ul>
        <div class="modal-actions">
          <button class="btn">Override and run with low confidence</button>
        </div>
      `
    },
    'cancel-agent': {
      title: 'Cancellation Risk Agent',
      meta: 'Scores forward bookings by cancellation probability · flags high-risk reservations',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value">Idle</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">every 2h</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v1.6</div></div>
          <div class="kpi"><div class="kpi-label">$ at risk</div><div class="kpi-value">$12.4k</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v1.6</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:170px;">You are the Cancellation Risk agent for The Namkhan.

# Your role
Every 2h, score every forward reservation by cancellation probability. Flag high-risk bookings. Recommend mitigation tactics. NEVER cancel reservations — only flag.

# Decision rules
For each forward booking, compute cancel_score (0-100) using:
- Channel base rate (e.g. CTrip historic 23% cancel = +30 baseline)
- Lead time vs ALOS (long lead, short stay = higher risk)
- Payment status (unpaid + non-pre-auth = +20)
- Guest history (first-time vs repeat)
- Cancellation pattern of similar bookings last 90d
- Days until check-in (closer = lower risk if not yet cancelled)

Flag if cancel_score > {{cancel.flag_threshold}} (default 70).

# Mitigation tactics by score band
- 90+: cancel and resell (window permitting)
- 70-89: pre-charge non-refundable conversion offer
- 50-69: WhatsApp confirmation outreach

# Hard constraints
- NEVER cancel a reservation directly — only propose
- DO NOT contact guests directly (hand off to Front Desk for outreach)
- Respect quiet hours for any outreach recommendations

# Output (JSON)
{ "bookings": [{ "id": "...", "channel": "...", "stay": "...", "revenue": ..., "cancel_score": ..., "recommended_action": "..." }] }</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">318 tokens</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test</button>
          </div>
        </div>

        <div class="modal-section-title">High-risk bookings</div>
        <table>
          <thead><tr><th>Booking</th><th>Channel</th><th>Stay</th><th>Revenue</th><th>Cancel score</th><th>Recommended</th></tr></thead>
          <tbody>
            <tr><td>#22481</td><td>Hospitality Solutions</td><td>May 14-16</td><td class="num">$1,840</td><td class="num neg">87</td><td>Pre-charge non-ref</td></tr>
            <tr><td>#22455</td><td>Traveloka</td><td>May 19-21</td><td class="num">$2,050</td><td class="num neg">95</td><td>Cancel and resell</td></tr>
            <tr><td>#22501</td><td>CTrip</td><td>May 22-24</td><td class="num">$1,650</td><td class="num neg">72</td><td>Confirm via WhatsApp</td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-primary">⚡ Fire now</button>
          <button class="btn">Edit scoring model</button>
        </div>
      `
    },
    'rank-agent': {
      title: 'Position Tracker',
      meta: 'Daily Booking.com / Google rank check for The Namkhan vs comp set',
      body: `<p style="font-size:12px;line-height:1.8;">Tracks position rank, review score, review count daily across Booking.com and Google. Currently #3 of 7 — stable 30 days.</p><div class="modal-actions"><button class="btn btn-primary">⚡ Fire now</button></div>`
    },
    'move-agent': {
      title: 'Rate Move Detector',
      meta: 'Watches for sudden rate changes across comp set properties',
      body: `<p style="font-size:12px;line-height:1.8;">Triggers alert when any tracked competitor moves rates ±5% within 24h or ±10% within 7d. Last alert: Mekong Estate -8% over 7 days.</p><div class="modal-actions"><button class="btn btn-primary">⚡ Fire now</button></div>`
    },
    'discovery-agent': {
      title: 'Comp Set Discovery Agent',
      meta: 'Weekly · proposes Local + Regional peer sets · uses BDC search co-occurrence + price band + reviews',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--green)">Running</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">weekly Sun 02:00</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v1.1</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$11.20</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v1.1</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:200px;">You are the Comp Set Discovery agent for The Namkhan in {{property.city}}.

# Your role
Once a week, propose new candidate properties for the Local LP and Regional SEA comp sets. Score each candidate using 6 weighted signals. NEVER auto-add to Manual Strategic list — always propose for human review.

# Discovery process
1. Pull all properties from Booking.com matching: {{property.country}} OR ({{compset.regional_geo}}) AND price_band ∈ ({{property.adr_min}} ÷ 0.75, {{property.adr_max}} × 1.25)
2. For each candidate, compute match_score (0-100):
   - BDC search co-occurrence (35%) — % of users searching The Namkhan who also viewed this property
   - Price band overlap (25%) — overlap of last 30d ADR ranges
   - Star rating match (15%) — same or ±0.5 star
   - Geographic proximity (10%) — same city or province
   - Review profile similarity (10%) — NLP cosine similarity on review text themes
   - Room count band (5%) — within ±50% of my room count

3. Split candidates into:
   - Local LP (same city, direct competitors)
   - Regional SEA luxury riverside (aspirational ADR ceiling reference)
   - Regional boutique heritage SEA (positioning peers)

4. Rank top 8 per category. Output for human review.

# Hard constraints
- DO NOT add to Manual Strategic list — only propose
- DO NOT include properties with &lt; 50 reviews (insufficient signal)
- DO NOT include properties marked as previously-rejected by the operator (in {{knowledge.rejected_candidates}})
- Respect Booking.com Partner API rate limits

# Output (JSON)
{ "local": [{ "name": "...", "match_score": ..., "reasoning": "...", "signals": {...} }], "regional_luxury": [...], "regional_boutique": [...] }</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">401 tokens · A/B test running: v1.0 vs v1.1</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test</button>
            <button class="prompt-btn">View A/B results</button>
          </div>
        </div>

        <div class="modal-section-title">Scoring signals</div>
        <table>
          <thead><tr><th>Signal</th><th>Weight</th><th>Source</th></tr></thead>
          <tbody>
            <tr><td>BDC search co-occurrence</td><td>35%</td><td>Booking Partner API</td></tr>
            <tr><td>Price band overlap (±25%)</td><td>25%</td><td>BDC + manual + AI scrape</td></tr>
            <tr><td>Star rating match</td><td>15%</td><td>BDC + Google Maps</td></tr>
            <tr><td>Geographic proximity</td><td>10%</td><td>Google Places</td></tr>
            <tr><td>Review profile similarity</td><td>10%</td><td>NLP on review text</td></tr>
            <tr><td>Room count band</td><td>5%</td><td>BDC</td></tr>
          </tbody>
        </table>
        <div class="modal-section-title">Output</div>
        <p style="font-size:12px;line-height:1.8;">Produces ranked Local + Regional candidate lists for the Comp Set tab. Adds new candidates as "pending review"; never auto-adds to Manual list — always requires human approval to keep Manual canonical.</p>
        <div class="modal-actions">
          <button class="btn btn-primary">⚡ Re-run discovery</button>
          <button class="btn">Open Comp Set · AI tab</button>
          <button class="btn">Edit scoring weights</button>
        </div>
      `
    },
    'tactical-agent': {
      title: 'Tactical Detector Agent',
      meta: 'Scans the cube · detects multi-dimensional demand gaps that single-dimension dashboards miss',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--green)">Running</div></div>
          <div class="kpi"><div class="kpi-label">Schedule</div><div class="kpi-value" style="font-size:14px">every 30 min</div></div>
          <div class="kpi"><div class="kpi-label">Prompt version</div><div class="kpi-value" style="font-size:14px">v3.2 ★</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$18.60</div></div>
        </div>

        <!-- TAB STRIP: which view -->
        <div class="prompt-editor-toolbar" style="border-radius:6px 6px 0 0;margin-bottom:0;">
          <div class="left">
            <span class="prompt-tab active">📝 Prompt</span>
            <span class="prompt-tab">🧩 Context variables</span>
            <span class="prompt-tab">📚 Knowledge files</span>
            <span class="prompt-tab">🧪 Test playground</span>
            <span class="prompt-tab">🕘 Version history</span>
            <span class="prompt-tab">🅰️ A/B test</span>
          </div>
          <span class="prompt-version">v3.2 · edited 2h ago</span>
        </div>

        <!-- THE PROMPT ITSELF -->
        <div class="prompt-editor-wrap" style="margin-top:0;border-radius:0 0 6px 6px;border-top:none;">
          <textarea class="prompt-textarea">You are the Tactical Detector for The Namkhan, a {{property.category}} riverside property in {{property.city}}, {{property.country}}.

# Your role
You scan the multi-dimensional booking cube every 30 minutes and detect demand gaps that single-dimension dashboards miss. You DO NOT take action. You produce alerts for the Tactic Composer agent and a human Revenue Manager to review.

# Your scope (data you can see)
- Cloudbeds OTB by: room_type × country × lead_window × LOS × channel × segment × stay_month
- Same Time Last Year (STLY) data for all dimensions where ≥{{detection.min_sample_size}} observations exist
- Budget targets per (room × stay_month) from {{property.budget_source}}
- Lead-time distribution per segment (rolling 18mo)
- Property-level events from {{knowledge.blackout_calendar}}
- Brand voice and category positioning from {{knowledge.brand_guide}}

# What you do NOT see (out of scope)
- Pricing decisions (the Composer/RM owns this)
- Channel-specific actions (the Composer owns tactic selection)
- Anything outside the booking cube — no guest reviews, no operations data, no P&L

# Decision rules
For each cube cell (room × country × window × LOS × stay_month):

1. Compute deviation = (OTB - STLY_at_same_point_in_window) / STLY_at_same_point_in_window
2. Compute $ impact = deviation × historical_avg_revenue_per_cell
3. Flag cell if:
   - |deviation| > {{detection.deviation_threshold}} (default 25%)
   - AND |$ impact| > {{detection.min_impact}} (default $1,000)
   - AND sample_size ≥ {{detection.min_sample_size}}
   - AND data_freshness < {{detection.max_staleness}}
4. Group correlated flagged cells into a single Alert when they share ≥3 dimensions
   (e.g. all EU countries + Suite + 30-60d window → ONE alert, not 4)
5. Compute window_closure_date based on lead-time P75 for that segment
6. Compute confidence_score (0-100) from:
   - STLY data quality (40 pts)
   - Sample size adequacy (30 pts)
   - Lead-time pattern stability (20 pts)
   - Data freshness (10 pts)

# Hard constraints (NEVER violate)
- Do NOT fire alerts on dates in {{knowledge.blackout_calendar}}
- Do NOT fire below confidence floor {{detection.confidence_floor}}
- Do NOT fire on cells where data_quality_score < 0.6
- Cool down: do NOT re-fire on same dimension combo within {{detection.cooldown_hours}}h
- During quiet hours {{detection.quiet_hours}}, queue alerts for next morning send

# Output format (strict JSON)
For each alert produced, return:
{
  "alert_id": "uuid",
  "title": "<≤80 char human-readable summary>",
  "dimensions": { "room": [...], "country": [...], "window": "...", "LOS": "...", "stay_month": "...", "segment": "..." },
  "deviation_pct": -34.2,
  "impact_usd": -18400,
  "confidence": 84,
  "window_closure_date": "2026-06-14",
  "diagnosis": "<≤200 char root cause hypothesis>",
  "evidence": [{"signal": "...", "value": "...", "source": "..."}],
  "suggested_handoff": "composer-agent"
}

# Escalation rules
- Critical alerts (impact > $25k OR window closes < 7d): also notify {{notify.critical}} via Slack
- Data anomalies (sudden >50% drops not in pattern): hand off to {{notify.data_quality}} BEFORE firing alert
- If confidence < {{detection.confidence_floor}} but impact > $50k: surface as "low-confidence high-impact" — flag for human review, don't auto-pass to Composer

# Tone
Be diagnostic, not prescriptive. Your job is to surface the gap and explain why it's happening. Tactic selection is the Composer's job. Stay in your lane.</textarea>

          <div class="prompt-footer">
            <span class="prompt-footer-meta">687 tokens · 6,124 chars · est. cost per run: $0.012</span>
            <button class="prompt-btn primary">💾 Save as v3.3</button>
            <button class="prompt-btn">🧪 Test before saving</button>
            <button class="prompt-btn">↶ Discard changes</button>
            <button class="prompt-btn danger" style="margin-left:auto;">⚠ Pause agent</button>
          </div>
        </div>

        <!-- CONTEXT VARIABLES -->
        <div class="modal-section-title">🧩 Context variables · injected at runtime</div>
        <div class="prompt-context-list">
          <div class="ctx-row"><span><span class="prompt-tag">{{property.category}}</span></span><span class="src">"boutique luxury riverside" · from settings</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{property.city}}</span></span><span class="src">"Luang Prabang" · from Cloudbeds</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{property.country}}</span></span><span class="src">"Laos" · from Cloudbeds</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{property.budget_source}}</span></span><span class="src">"Sheets/budget_2026" · from data integrations</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.deviation_threshold}}</span></span><span class="src">25% · from Layer 1 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.min_impact}}</span></span><span class="src">$1,000 · from Layer 1 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.confidence_floor}}</span></span><span class="src">70% · from Layer 1 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.cooldown_hours}}</span></span><span class="src">6 · from Layer 1 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.quiet_hours}}</span></span><span class="src">"22:00-07:00 LAK" · from Layer 1 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.min_sample_size}}</span></span><span class="src">10 obs · from Layer 1 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{detection.max_staleness}}</span></span><span class="src">2h · from Layer 6 guardrails</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{notify.critical}}</span></span><span class="src">"#namkhan-revenue" · Slack channel</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{notify.data_quality}}</span></span><span class="src">"federico@thenamkhan.com" · email</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{knowledge.blackout_calendar}}</span></span><span class="src">file: blackout_dates.json (5 entries)</span></div>
          <div class="ctx-row"><span><span class="prompt-tag">{{knowledge.brand_guide}}</span></span><span class="src">file: namkhan_brand_voice.md</span></div>
        </div>
        <p style="font-size:11px;color:var(--text-dim);margin-top:6px;line-height:1.6;">Variables in <span class="prompt-tag">{{double braces}}</span> are filled at runtime. Editing a guardrail value (Layer 1-9) automatically flows into the prompt — no need to re-edit. Add new variables via <a class="clickable">+ Add variable</a>.</p>

        <!-- KNOWLEDGE FILES -->
        <div class="modal-section-title">📚 Knowledge files · attached to this agent</div>
        <div class="knowledge-list">
          <div class="knowledge-row">
            <div class="kfile-icon">MD</div>
            <div class="kfile-name">namkhan_brand_voice.md</div>
            <div class="kfile-meta">2.1 KB · last updated 14d ago</div>
            <a class="clickable" style="font-size:11px;">view</a>
            <a class="clickable" style="font-size:11px;color:var(--red);">remove</a>
          </div>
          <div class="knowledge-row">
            <div class="kfile-icon">JSON</div>
            <div class="kfile-name">blackout_dates.json</div>
            <div class="kfile-meta">5 events · synced from Layer 2 guardrails</div>
            <a class="clickable" style="font-size:11px;">view</a>
            <span style="font-size:10px;color:var(--text-faint);">auto-synced</span>
          </div>
          <div class="knowledge-row">
            <div class="kfile-icon">MD</div>
            <div class="kfile-name">04_USALI_MAPPING.md</div>
            <div class="kfile-meta">your USALI segment mapping · 4.2 KB</div>
            <a class="clickable" style="font-size:11px;">view</a>
            <a class="clickable" style="font-size:11px;color:var(--red);">remove</a>
          </div>
          <div class="knowledge-row">
            <div class="kfile-icon">MD</div>
            <div class="kfile-name">05_KPI_DEFINITIONS.md</div>
            <div class="kfile-meta">your KPI definitions · 3.7 KB</div>
            <a class="clickable" style="font-size:11px;">view</a>
            <a class="clickable" style="font-size:11px;color:var(--red);">remove</a>
          </div>
          <div class="knowledge-row">
            <div class="kfile-icon">CSV</div>
            <div class="kfile-name">historical_lead_time_distribution.csv</div>
            <div class="kfile-meta">18mo per-segment · auto-refreshed nightly</div>
            <a class="clickable" style="font-size:11px;">view</a>
            <span style="font-size:10px;color:var(--text-faint);">auto-synced</span>
          </div>
        </div>
        <button class="btn" style="font-size:11px;margin-top:10px;">+ Attach knowledge file</button>

        <!-- TEST PLAYGROUND -->
        <div class="modal-section-title">🧪 Test playground</div>
        <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px;line-height:1.6;">
          Run the current prompt against historical cube data from a chosen date. Compare what alerts <em>would have fired</em> vs what <em>actually happened</em>. The goal: tune the prompt until it surfaces the alerts you wish you'd seen at the time.
        </p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:11px;">Replay date:</span>
          <input class="gr-input wide" type="date" value="2026-03-15">
          <button class="prompt-btn primary">▶ Run test</button>
          <span style="font-size:11px;color:var(--text-dim);">Estimated cost: $0.014 · runtime ~8s</span>
        </div>
        <div class="playground-result">
          <div class="pg-label">Last test run · 2026-03-15 replay</div>
3 alerts produced:<br>
• [HIGH] EU Suite window closing · -$14.2k · 81% conf · ✅ matches actual gap that emerged 8d later<br>
• [MED] Asian leisure short-LOS Glamping · +$4.8k · 68% conf · ✅ matches what happened<br>
• [LOW] DACH long-haul Q3 · -$2.1k · 73% conf · ❌ false positive (DACH actually came in strong)<br>
<br>
<strong>Recall vs ground truth:</strong> 2/3 = 67% (industry good is &gt;75%)<br>
<strong>Suggestion:</strong> Tighten DACH-specific lead-time distribution — current model is over-weighted on aggregate EU pattern.
        </div>

        <!-- VERSION HISTORY (compact) -->
        <div class="modal-section-title">🕘 Version history</div>
        <table>
          <thead><tr><th>Version</th><th>Changed</th><th>Edit by</th><th>Diff summary</th><th></th></tr></thead>
          <tbody>
            <tr style="background:#fdf8f1;"><td><span style="font-family:monospace;color:var(--accent);font-weight:600;">v3.2 ★</span></td><td>2h ago</td><td>Federico</td><td>Added DACH-specific override · tightened cooldown rule</td><td><span class="rule-status active">active</span></td></tr>
            <tr><td><span style="font-family:monospace;">v3.1</span></td><td>14d ago</td><td>Federico</td><td>Added confidence_score formula · added quiet hours logic</td><td><a class="clickable">view diff</a> · <a class="clickable">revert</a></td></tr>
            <tr><td><span style="font-family:monospace;">v3.0</span></td><td>32d ago</td><td>Federico</td><td>Major rewrite · added grouping logic · added JSON output spec</td><td><a class="clickable">view diff</a> · <a class="clickable">revert</a></td></tr>
            <tr><td><span style="font-family:monospace;">v2.4</span></td><td>48d ago</td><td>Federico</td><td>Added "stay in your lane" tone instruction</td><td><a class="clickable">view diff</a> · <a class="clickable">revert</a></td></tr>
            <tr><td><span style="font-family:monospace;">v2.0 → v2.3</span></td><td>50-90d ago</td><td>—</td><td>Iterative tuning</td><td><a class="clickable">expand</a></td></tr>
            <tr><td><span style="font-family:monospace;color:var(--text-faint);">v1.0</span></td><td>120d ago</td><td>Setup</td><td>Initial template</td><td><a class="clickable">view</a></td></tr>
          </tbody>
        </table>

        <!-- A/B TEST -->
        <div class="modal-section-title">🅰️ A/B testing · two prompts running in parallel</div>
        <div style="background:#fdf8f1;border:1px solid var(--accent);border-radius:6px;padding:14px;margin-top:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:12px;">Active test: v3.1 (control) vs v3.2 (treatment)</strong>
            <span class="rule-status active">running · 14d in · 1.2k decisions</span>
          </div>
          <table>
            <thead><tr><th>Metric</th><th class="num">v3.1 control</th><th class="num">v3.2 treatment</th><th>Δ</th><th>Significant?</th></tr></thead>
            <tbody>
              <tr><td>Alerts fired</td><td class="num">142</td><td class="num">98</td><td class="num neg">-31%</td><td>p &lt; 0.01 ✓</td></tr>
              <tr><td>Precision (true positive rate)</td><td class="num">61%</td><td class="num">79%</td><td class="num pos">+18pp</td><td>p &lt; 0.01 ✓</td></tr>
              <tr><td>Recall (caught real gaps)</td><td class="num">82%</td><td class="num">76%</td><td class="num neg">-6pp</td><td>p = 0.18</td></tr>
              <tr><td>RM action rate (% acted on)</td><td class="num">42%</td><td class="num">68%</td><td class="num pos">+26pp</td><td>p &lt; 0.01 ✓</td></tr>
              <tr><td>Avg alert $ impact</td><td class="num">$3.1k</td><td class="num">$8.4k</td><td class="num pos">+170%</td><td>p &lt; 0.01 ✓</td></tr>
            </tbody>
          </table>
          <div style="margin-top:10px;font-size:11px;line-height:1.6;color:var(--text);">
            <strong>Verdict:</strong> v3.2 fires fewer but bigger and more accurate alerts. RM acts on 68% vs 42% (less alert fatigue). Recall slightly lower but not significant. <strong>Recommendation: graduate v3.2 to control.</strong>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;">
            <button class="btn btn-primary" style="font-size:11px;">Graduate v3.2 → control</button>
            <button class="btn" style="font-size:11px;">Continue test 7 more days</button>
            <button class="btn" style="font-size:11px;color:var(--red);">Abort · keep v3.1</button>
          </div>
        </div>

        <div class="modal-actions" style="margin-top:18px;">
          <button class="btn btn-primary">⚡ Run scan now</button>
          <button class="btn">Open Cube viewer</button>
          <button class="btn" style="color:var(--red);border-color:var(--red);">Pause agent</button>
        </div>
      `
    },
    'composer-agent': {
      title: 'Tactic Composer Agent',
      meta: 'Triggered by Tactical Detector · selects tactics from library · composes multi-channel response · drafts handoff briefs',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:var(--green)">Running</div></div>
          <div class="kpi"><div class="kpi-label">Library</div><div class="kpi-value">47</div></div>
          <div class="kpi"><div class="kpi-label">Prompt</div><div class="kpi-value" style="font-size:14px">v2.4</div></div>
          <div class="kpi"><div class="kpi-label">Cost / month</div><div class="kpi-value" style="font-size:14px">$22.40</div></div>
        </div>

        <div class="modal-section-title">📝 System prompt · v2.4</div>
        <div class="prompt-editor-wrap">
          <textarea class="prompt-textarea" style="min-height:230px;">You are the Tactic Composer for The Namkhan in {{property.city}}.

# Your role
When the Tactical Detector fires an alert, select a multi-channel response from the {{tactic.library_size}}-tactic library. Compose a plan. Draft handoff briefs for specialist agents. NEVER execute — only draft.

# Decision rules
1. Receive alert from Tactical Detector with dimensions (room × country × window × LOS × stay_month × segment) and $ impact
2. Filter library to tactics tagged with matching dimensions
3. Score each candidate tactic:
   - Predicted ROAS (40%) — based on last 6mo of similar plays
   - Speed-to-impact (25%) — critical when window is closing
   - Budget headroom (20%) — respect {{budget.monthly_caps}} per channel
   - Brand fit (15%) — check {{knowledge.brand_guide}} for tone, discount limits, positioning
4. Pick top 4-6 tactics. Default 3 pre-selected (highest combined ROAS within budget).
5. Sequence by speed-to-impact when window is closing &lt; 14d
6. For each picked tactic, draft a brief for the appropriate specialist:
   - Paid media → Campaign Planner
   - Email → Email Agent
   - Social → Social Agent
   - Content → Content Agent
   - B2B/Wholesale/DMC → B2B Agent
   - Restriction/rate change → Revenue Manager (you, the human)

# Hard constraints
- NEVER pick tactics that exceed {{budget.monthly_caps}} per channel
- NEVER pick discount tactics &gt; {{brand.max_discount_suite}} on Suites or {{brand.max_discount_glamping}} on Glamping
- NEVER pick flash sales within {{brand.peak_buffer_days}} days of peak dates
- NEVER bypass approval — all tactics surface for human review before any execution
- Respect blackout dates {{knowledge.blackout_calendar}}

# Output (JSON)
{ "alert_id": "...", "composed_tactics": [{ "tactic_id": "...", "channel": "...", "title": "...", "rationale": "...", "expected_roas": ..., "spend": ..., "expected_revenue": ..., "specialist": "...", "selected": bool }], "plan_total_revenue": ..., "plan_probability": ..., "specialists_to_handoff": [...] }

# Tone
Pragmatic. Each tactic includes the rationale the RM needs to approve quickly. No fluff.</textarea>
          <div class="prompt-footer">
            <span class="prompt-footer-meta">542 tokens · est. cost per compose: $0.018</span>
            <button class="prompt-btn primary">💾 Save</button>
            <button class="prompt-btn">🧪 Test against last alert</button>
          </div>
        </div>

        <div class="modal-section-title">Tactic library · 47 tactics across 6 channels</div>
        <table>
          <thead><tr><th>Channel</th><th>Tactics</th><th>Avg ROAS</th><th>Avg lead time</th></tr></thead>
          <tbody>
            <tr><td>Booking.com</td><td class="num">9</td><td class="num">4.2×</td><td>2-3d to deploy</td></tr>
            <tr><td>Expedia</td><td class="num">6</td><td class="num">3.8×</td><td>2-4d</td></tr>
            <tr><td>Google Ads</td><td class="num">11</td><td class="num">5.1×</td><td>1d</td></tr>
            <tr><td>Meta (FB/IG)</td><td class="num">8</td><td class="num">3.5×</td><td>1-2d</td></tr>
            <tr><td>Email / Direct</td><td class="num">7</td><td class="num">12.4×</td><td>same day</td></tr>
            <tr><td>B2B / Wholesale / DMC</td><td class="num">6</td><td class="num">6.8×</td><td>5-14d</td></tr>
          </tbody>
        </table>
        <div class="modal-section-title">Composer logic</div>
        <ul style="list-style:disc;padding-left:20px;font-size:12px;line-height:1.8;">
          <li><strong>Match dimensions:</strong> tactics tagged with applicable (room × country × window × segment) — only tactics matching the alert's dimensions surface</li>
          <li><strong>Budget caps:</strong> respects monthly per-channel budget caps from settings</li>
          <li><strong>Probability weighting:</strong> ROAS prediction uses last 6 months of similar plays</li>
          <li><strong>Brand rules:</strong> certain tactics blocked (e.g. no &gt;15% discounts on Suites · no flash sales 14d before peak)</li>
          <li><strong>Sequencing:</strong> orders tactics by speed-to-impact for closing windows</li>
        </ul>
        <div class="modal-section-title">Handoff specialists</div>
        <p style="font-size:12px;line-height:1.8;">Composer never executes tactics directly. It drafts briefs and hands off to: Campaign Planner (paid media), Email Agent, Social Agent, Content Agent, B2B/DMC Agent, Revenue Manager (restrictions/rates). Each specialist drafts the full execution plan for human approval before any external action.</p>
        <div class="modal-actions">
          <button class="btn btn-primary">⚡ Re-compose for active alerts</button>
          <button class="btn">Edit tactic library</button>
          <button class="btn">Edit budget caps</button>
        </div>
      `
    }
  };

  function openAgent(agentId) {
    const agent = agentDetails[agentId];
    if (!agent) return;
    modalTitle.textContent = agent.title;
    modalMeta.textContent = agent.meta;
    modalBody.innerHTML = agent.body;
    modalOverlay.classList.add('open');
  }

  // ============= Comp Set modal charts =============
  charts['compset-matrix'] = {
    title: 'Comp Set Rate Matrix · Next 14 Days',
    meta: 'Booking.com BAR · entry-level room · all 7 properties',
    render: () => `
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">Full 14-day matrix with daily granularity, weekend highlighting, and click-through to source URL/screenshot.</p>
      <table>
        <thead><tr><th>Property</th>${[2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(d => `<th class="compset-cell">May ${d}</th>`).join('')}<th class="compset-cell">Avg</th></tr></thead>
        <tbody>
          <tr style="background:#fdf8f1;font-weight:600"><td>★ The Namkhan</td><td class="compset-cell">$235</td><td class="compset-cell">$235</td><td class="compset-cell">$245</td><td class="compset-cell">$215</td><td class="compset-cell">$215</td><td class="compset-cell">$245</td><td class="compset-cell">$265</td><td class="compset-cell">$265</td><td class="compset-cell">$235</td><td class="compset-cell">$215</td><td class="compset-cell">$215</td><td class="compset-cell">$245</td><td class="compset-cell">$265</td><td class="compset-cell">$235</td><td class="compset-cell"><strong>$235</strong></td></tr>
          <tr><td>Rosewood</td><td class="compset-cell">$485</td><td class="compset-cell">$485</td><td class="compset-cell">$510</td><td class="compset-cell">$465</td><td class="compset-cell">$465</td><td class="compset-cell">$525</td><td class="compset-cell">$565</td><td class="compset-cell">$565</td><td class="compset-cell">$485</td><td class="compset-cell">$465</td><td class="compset-cell">$465</td><td class="compset-cell">$525</td><td class="compset-cell">$565</td><td class="compset-cell">$485</td><td class="compset-cell">$498</td></tr>
          <tr><td>Avani+</td><td class="compset-cell">$280</td><td class="compset-cell">$280</td><td class="compset-cell">$295</td><td class="compset-cell">$255</td><td class="compset-cell">$255</td><td class="compset-cell">$295</td><td class="compset-cell">$320</td><td class="compset-cell">$320</td><td class="compset-cell">$280</td><td class="compset-cell">$255</td><td class="compset-cell">$255</td><td class="compset-cell">$295</td><td class="compset-cell">$320</td><td class="compset-cell">$280</td><td class="compset-cell">$280</td></tr>
          <tr style="background:#fef2f2"><td>Mekong Estate ⚠</td><td class="compset-cell">$215</td><td class="compset-cell">$215</td><td class="compset-cell">$225</td><td class="compset-cell">$195</td><td class="compset-cell">$195</td><td class="compset-cell">$225</td><td class="compset-cell">$245</td><td class="compset-cell">$245</td><td class="compset-cell">$215</td><td class="compset-cell">$195</td><td class="compset-cell">$195</td><td class="compset-cell">$225</td><td class="compset-cell">$245</td><td class="compset-cell">$215</td><td class="compset-cell">$216</td></tr>
          <tr><td>Sofitel</td><td class="compset-cell">$355</td><td class="compset-cell">$355</td><td class="compset-cell">$375</td><td class="compset-cell">$325</td><td class="compset-cell">$325</td><td class="compset-cell">$385</td><td class="compset-cell">$415</td><td class="compset-cell">$415</td><td class="compset-cell">$355</td><td class="compset-cell">$325</td><td class="compset-cell">$325</td><td class="compset-cell">$385</td><td class="compset-cell">$415</td><td class="compset-cell">$355</td><td class="compset-cell">$362</td></tr>
          <tr><td>3 Nagas</td><td class="compset-cell">$185</td><td class="compset-cell">$185</td><td class="compset-cell">$195</td><td class="compset-cell">$165</td><td class="compset-cell">$165</td><td class="compset-cell">$195</td><td class="compset-cell">$215</td><td class="compset-cell">$215</td><td class="compset-cell">$185</td><td class="compset-cell">$165</td><td class="compset-cell">$165</td><td class="compset-cell">$195</td><td class="compset-cell">$215</td><td class="compset-cell">$185</td><td class="compset-cell">$186</td></tr>
          <tr><td>Satri House</td><td class="compset-cell">$245</td><td class="compset-cell">$245</td><td class="compset-cell">$255</td><td class="compset-cell">$215</td><td class="compset-cell">$215</td><td class="compset-cell">$255</td><td class="compset-cell">$285</td><td class="compset-cell">$285</td><td class="compset-cell">$245</td><td class="compset-cell">$215</td><td class="compset-cell">$215</td><td class="compset-cell">$255</td><td class="compset-cell">$285</td><td class="compset-cell">$245</td><td class="compset-cell">$245</td></tr>
        </tbody>
      </table>
      <div class="modal-actions">
        <button class="btn btn-primary">Export</button>
        <button class="btn">Snapshot to PDF</button>
      </div>
    `
  };
  charts['compset-position'] = {
    title: 'Rate Position vs Comp Set Median · 90 days',
    meta: 'Daily % above/below median for all 7 properties',
    render: () => `
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">90-day daily position chart with all 7 competitors overlaid + Namkhan trend line. In production: filter by property, room type, day-of-week.</p>
      <div style="background:#f7f8fa;padding:24px;border-radius:6px;text-align:center;color:var(--text-dim);font-size:12px;">
        [Full 90-day comparison chart with property toggles + day-of-week filter]
      </div>
    `
  };
  charts['compset-str'] = {
    title: 'STR-style Indices · 90 days',
    meta: 'MPI · ARI · RGI trend with comp set context',
    render: () => `
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">Time-series of all three indices, weekly aggregated. Drill: which properties drove the comp set average each week.</p>
      <table>
        <thead><tr><th>Week</th><th class="num">MPI</th><th class="num">ARI</th><th class="num">RGI</th><th class="num">My Occ</th><th class="num">Comp Occ</th><th class="num">My ADR</th><th class="num">Comp ADR</th></tr></thead>
        <tbody>
          <tr><td>W14</td><td class="num">98</td><td class="num">105</td><td class="num">103</td><td class="num">31%</td><td class="num">32%</td><td class="num">$228</td><td class="num">$217</td></tr>
          <tr><td>W15</td><td class="num">100</td><td class="num">106</td><td class="num">106</td><td class="num">33%</td><td class="num">33%</td><td class="num">$230</td><td class="num">$217</td></tr>
          <tr><td>W16</td><td class="num">101</td><td class="num">107</td><td class="num">108</td><td class="num">34%</td><td class="num">34%</td><td class="num">$232</td><td class="num">$217</td></tr>
          <tr style="background:#f0fdf4"><td><strong>W17 (last)</strong></td><td class="num">102</td><td class="num">108</td><td class="num">110</td><td class="num">34%</td><td class="num">33%</td><td class="num">$235</td><td class="num">$217</td></tr>
        </tbody>
      </table>
      <div class="modal-actions">
        <button class="btn btn-primary">Export STR-style report</button>
      </div>
    `
  };
