// app/revenue-v2/_data.ts
// All dummy data for the revenue-v2 rebuild. Hardcoded — no API calls in this phase.
// Shapes match DUMMY_DATA_SHAPES.md so Phase 2 wiring is a drop-in swap.

export const FX_LAK = 21500; // 1 USD = ~21,500 LAK (illustrative)

export const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}k`
    : `$${Math.round(n).toLocaleString("en-US")}`;

export const lak = (n: number) =>
  n >= 1_000_000_000
    ? `₭${(n / 1_000_000_000).toFixed(1)}B`
    : n >= 1_000_000
    ? `₭${(n / 1_000_000).toFixed(1)}M`
    : `₭${Math.round(n / 1000).toLocaleString("en-US")}k`;

export const pct = (n: number, sign = false) =>
  `${sign && n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;

export const NAV = [
  { href: "/revenue-v2", label: "Entry" },
  { href: "/revenue-v2/pulse", label: "Pulse" },
  { href: "/revenue-v2/pace", label: "Pace" },
  { href: "/revenue-v2/channels", label: "Channels" },
  { href: "/revenue-v2/rateplans", label: "Rate plans" },
  { href: "/revenue-v2/pricing", label: "Pricing" },
  { href: "/revenue-v2/compset", label: "Comp set" },
  { href: "/revenue-v2/parity", label: "Parity" },
  { href: "/revenue-v2/agents", label: "Agents" },
];

export const REFRESHED_AT = "2026-05-07 09:14 ICT";

// ─── Entry page ────────────────────────────────────────────────────────────
export const entryData = {
  greeting: {
    user_name: "Hannes",
    timestamp: "2026-05-07T09:14:00+07:00",
    one_line: "Numbers look good. One thing needs you.",
  },
  kpis: [
    { l: "Occupancy", v: "28.1%", d: [{ vs: "LY", t: "+2.9%", c: "up" }] },
    { l: "ADR", v: "$209", d: [{ vs: "LY", t: "+6.1%", c: "up" }] },
    { l: "RevPAR", v: "$59", d: [{ vs: "LY", t: "+7.3%", c: "up" }] },
    { l: "Pickup 24h", v: "8 rms", d: [{ vs: "rev", t: "$2.5k", c: "" }] },
    { l: "Pickup 7d", v: "45 rms", d: [{ vs: "rev", t: "$13.8k", c: "" }] },
    { l: "vs Budget", v: "+$8k", d: [{ vs: "Bud", t: "+1.7%", c: "up" }] },
  ],
  alerts: [
    {
      id: "a1",
      sev: "info" as const,
      cat: "pricing",
      title: "5 pricing recommendations queued",
      meta: "Review by 16:00 · 2 flagged soft-floor",
      route: "/revenue-v2/pricing",
    },
    {
      id: "a2",
      sev: "warn" as const,
      cat: "compset",
      title: "Burasari Heritage promo activity 67.8%",
      meta: "Avg discount 56.8% · always discounting",
      route: "/revenue-v2/compset",
    },
    {
      id: "a3",
      sev: "urgent" as const,
      cat: "parity",
      title: "Booking.com −12% on May 4",
      meta: "Parity Watchdog detected 1 min ago",
      route: "/revenue-v2/parity",
    },
    {
      id: "a4",
      sev: "info" as const,
      cat: "pace",
      title: "Pickup 7d ahead of STLY by +18%",
      meta: "45 rooms / $13.8k · Pace agent",
      route: "/revenue-v2/pace",
    },
  ],
};

// ─── Pulse ─────────────────────────────────────────────────────────────────
export const pulseData = {
  header: {
    title: "Last 30 days",
    narrative:
      "Demand is firm. RevPAR <em>up 7.3%</em> on LY, with direct mix climbing again. Watch the May 4 parity gap on Booking.com — everything else is on plan.",
    meta: "8 Apr → 7 May · USALI · mv_kpi_daily",
  },
  vital: [
    { l: "Occupancy", v: "62.4%", d: [{ vs: "LY", t: "+4.1pp", c: "up" }, { vs: "Bud", t: "−1.2pp", c: "down" }] },
    { l: "ADR", v: "$262", d: [{ vs: "LY", t: "+5.8%", c: "up" }, { vs: "Bud", t: "+2.1%", c: "up" }] },
    { l: "RevPAR", v: "$163", d: [{ vs: "LY", t: "+10.2%", c: "up" }, { vs: "Bud", t: "+0.8%", c: "up" }] },
    { l: "TRevPAR", v: "$208", d: [{ vs: "LY", t: "+9.4%", c: "up" }, { vs: "Bud", t: "+1.2%", c: "up" }] },
  ],
  hero_chart: {
    title: "Daily revenue (USD)",
    points: [
      { d: "8 Apr", a: 4200, c: 3800 }, { d: "9", a: 4600, c: 4100 }, { d: "10", a: 5100, c: 4400 },
      { d: "11", a: 5500, c: 4900 }, { d: "12", a: 6200, c: 5300 }, { d: "13", a: 5800, c: 5100 },
      { d: "14", a: 5300, c: 4700 }, { d: "15", a: 5700, c: 4900 }, { d: "16", a: 6400, c: 5200 },
      { d: "17", a: 7100, c: 5800 }, { d: "18", a: 6800, c: 5600 }, { d: "19", a: 6500, c: 5500 },
      { d: "20", a: 6200, c: 5300 }, { d: "21", a: 5900, c: 5100 }, { d: "22", a: 6300, c: 5400 },
      { d: "23", a: 6900, c: 5700 }, { d: "24", a: 7300, c: 6000 }, { d: "25", a: 7800, c: 6300 },
      { d: "26", a: 7500, c: 6200 }, { d: "27", a: 7100, c: 6000 }, { d: "28", a: 6800, c: 5800 },
      { d: "29", a: 7200, c: 6100 }, { d: "30", a: 7600, c: 6300 }, { d: "1 May", a: 8100, c: 6500 },
      { d: "2", a: 7900, c: 6400 }, { d: "3", a: 7400, c: 6200 }, { d: "4", a: 6900, c: 5900 },
      { d: "5", a: 6500, c: 5700 }, { d: "6", a: 6800, c: 5800 }, { d: "7", a: 7100, c: 6000 },
    ],
  },
  channel_mix: [
    { name: "Direct", share: 41.2, rev: 89400, delta: "+3.4pp" },
    { name: "Booking.com", share: 28.6, rev: 62100, delta: "−1.8pp" },
    { name: "Expedia / VR", share: 13.4, rev: 29100, delta: "−0.6pp" },
    { name: "Wholesale / DMC", share: 10.1, rev: 21900, delta: "+0.2pp" },
    { name: "Other", share: 6.7, rev: 14500, delta: "−1.2pp" },
  ],
  room_types: [
    { name: "Garden Studio", occ: 71.4, sold: 200, avail: 280, stly: 64.0 },
    { name: "River Bungalow", occ: 68.2, sold: 191, avail: 280, stly: 63.5 },
    { name: "Riverside Loft", occ: 64.6, sold: 181, avail: 280, stly: 60.1 },
    { name: "Heritage Suite", occ: 58.3, sold: 81, avail: 140, stly: 54.0 },
    { name: "Two-Bed Villa", occ: 52.1, sold: 73, avail: 140, stly: 47.8 },
    { name: "Pool Villa", occ: 49.6, sold: 69, avail: 140, stly: 45.2 },
    { name: "Forest Cabin", occ: 44.3, sold: 62, avail: 140, stly: 42.0 },
    { name: "Family Pavilion", occ: 38.9, sold: 27, avail: 70, stly: 35.4 },
  ],
  top: [
    { name: "Direct revenue +18% on LY", meta: "$89.4k · 41.2% mix", delta: "+18%", cls: "pos" },
    { name: "Heritage Suite ADR +12%", meta: "Avg $410 · 58 sold", delta: "+12%", cls: "pos" },
    { name: "Pickup 7d 45 rooms", meta: "$13.8k · Pace agent", delta: "+18%", cls: "pos" },
  ],
  attention: [
    { name: "Booking.com parity gap", meta: "−12% on May 4", delta: "−12%", cls: "neg" },
    { name: "Forest Cabin under STLY", meta: "44.3% vs 47.5%", delta: "−3.2pp", cls: "neg" },
    { name: "DMC commission creep", meta: "Avg 18.4% · was 16.1%", delta: "+2.3pp", cls: "neg" },
  ],
  outlook: {
    title: "Looking forward — Next 30 days",
    text: "Pacing <em>+18%</em> ahead of STLY on the books. Three group-rate windows opened (May 14–16, May 22, Jun 1–3) need a call by Friday. Floor logic still active on weekends.",
    stats: [
      { l: "OTB rooms", v: "412", m: "+62 vs STLY" },
      { l: "OTB revenue", v: "$108k", m: "+19% vs STLY" },
      { l: "Pickup 7d projection", v: "+185 rms", m: "On trend" },
      { l: "Group decisions", v: "3", m: "Due by Fri" },
    ],
  },
};

// ─── Pace ──────────────────────────────────────────────────────────────────
export const paceData = {
  header: {
    title: "Booking pace",
    sub: "Pace curve · last 30 + next 30 · pickup velocity 28d",
    meta: "Source · CLOUDBEDS · v_pace_curve · refreshed 2 min ago",
  },
  summary: [
    { l: "OTB rooms (Next 30)", v: "412", d: [{ vs: "STLY", t: "+62", c: "up" }] },
    { l: "Pickup 7d", v: "45 rms", d: [{ vs: "rev", t: "$13.8k", c: "up" }] },
    { l: "Pace vs STLY", v: "+18.4%", d: [{ vs: "trend", t: "ahead", c: "up" }] },
    { l: "Pace vs Budget", v: "−2.1%", d: [{ vs: "trend", t: "soft", c: "down" }] },
  ],
  // 60 days: -30 (history) → +30 (future)
  pace_curve: Array.from({ length: 60 }, (_, i) => {
    const day = i - 30;
    const future = day > 0;
    const baseStly = 8 + Math.sin(i / 6) * 4 + i * 0.18;
    const otb = future ? baseStly * (1.18 + Math.random() * 0.05) : 0;
    const actual = future ? null : baseStly * (1.05 + Math.sin(i / 4) * 0.1);
    return {
      d: future ? `+${day}` : `${day}`,
      stly: +baseStly.toFixed(1),
      otb: future ? +otb.toFixed(1) : 0,
      actual: actual !== null ? +actual.toFixed(1) : null,
      budget: +(baseStly * 1.2).toFixed(1),
    };
  }),
  pickup_28d: Array.from({ length: 28 }, (_, i) => {
    const v = 4 + Math.sin(i / 3) * 3 + Math.random() * 4;
    return { d: i + 1, daily: Math.round(v), ma7: +v.toFixed(1) };
  }),
  daily: [
    { date: "2026-05-08", otb: 14, stly: 11, var: 27.3, p24: 2, p7: 8, rev: 3460 },
    { date: "2026-05-09", otb: 17, stly: 13, var: 30.8, p24: 3, p7: 11, rev: 4250 },
    { date: "2026-05-10", otb: 16, stly: 14, var: 14.3, p24: 2, p7: 9, rev: 4010 },
    { date: "2026-05-11", otb: 12, stly: 12, var: 0.0, p24: 1, p7: 7, rev: 2980 },
    { date: "2026-05-12", otb: 19, stly: 15, var: 26.7, p24: 4, p7: 12, rev: 4810 },
    { date: "2026-05-13", otb: 18, stly: 14, var: 28.6, p24: 3, p7: 11, rev: 4530 },
    { date: "2026-05-14", otb: 22, stly: 16, var: 37.5, p24: 5, p7: 14, rev: 5640 },
    { date: "2026-05-15", otb: 21, stly: 17, var: 23.5, p24: 3, p7: 13, rev: 5380 },
    { date: "2026-05-16", otb: 16, stly: 14, var: 14.3, p24: 2, p7: 10, rev: 4060 },
    { date: "2026-05-17", otb: 13, stly: 12, var: 8.3, p24: 1, p7: 8, rev: 3290 },
    { date: "2026-05-18", otb: 14, stly: 13, var: 7.7, p24: 1, p7: 9, rev: 3540 },
    { date: "2026-05-19", otb: 15, stly: 12, var: 25.0, p24: 2, p7: 9, rev: 3810 },
    { date: "2026-05-20", otb: 18, stly: 13, var: 38.5, p24: 3, p7: 12, rev: 4630 },
    { date: "2026-05-21", otb: 20, stly: 14, var: 42.9, p24: 4, p7: 13, rev: 5140 },
    { date: "2026-05-22", otb: 24, stly: 16, var: 50.0, p24: 6, p7: 16, rev: 6180 },
  ],
};

// ─── Channels ──────────────────────────────────────────────────────────────
export const channelData = {
  header: {
    title: "Channels",
    sub: "Mix · gross & net ADR · commission · 12-month trend",
    meta: "Source · CLOUDBEDS · v_channel_mix · refreshed 4 min ago",
  },
  summary: [
    { l: "Direct mix", v: "41.2%", d: [{ vs: "LY", t: "+3.4pp", c: "up" }] },
    { l: "OTA mix", v: "42.0%", d: [{ vs: "LY", t: "−2.4pp", c: "down" }] },
    { l: "Wholesale mix", v: "10.1%", d: [{ vs: "LY", t: "+0.2pp", c: "up" }] },
    { l: "Avg net ADR", v: "$231", d: [{ vs: "LY", t: "+5.4%", c: "up" }] },
  ],
  months: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"],
  mix_over_time: [
    { name: "Direct", color: "#c79a6b", values: [32, 33, 34, 35, 36, 38, 39, 38, 39, 40, 41, 41] },
    { name: "OTA", color: "#a1a1aa", values: [44, 44, 44, 43, 42, 42, 42, 43, 42, 42, 42, 42] },
    { name: "Wholesale", color: "#6b6b75", values: [14, 13, 12, 12, 12, 11, 10, 10, 10, 10, 10, 10] },
    { name: "Other", color: "#3b3b45", values: [10, 10, 10, 10, 10, 9, 9, 9, 9, 8, 7, 7] },
  ],
  channels: [
    { name: "Direct", rms: 391, gross: 245, comm: 0.0, net: 245, rev: 95795, delta: "+18.4%", cls: "pos" },
    { name: "Booking.com", rms: 268, gross: 268, comm: 17.5, net: 221, rev: 59188, delta: "+4.2%", cls: "pos" },
    { name: "Expedia", rms: 91, gross: 251, comm: 18.0, net: 206, rev: 18746, delta: "−6.1%", cls: "neg" },
    { name: "Agoda", rms: 38, gross: 234, comm: 19.5, net: 188, rev: 7144, delta: "−2.4%", cls: "neg" },
    { name: "Wholesale (DMC)", rms: 96, gross: 192, comm: 22.0, net: 150, rev: 14400, delta: "+1.1%", cls: "pos" },
    { name: "Corporate", rms: 41, gross: 215, comm: 8.0, net: 198, rev: 8118, delta: "+0.6%", cls: "pos" },
    { name: "Walk-in / Other", rms: 24, gross: 198, comm: 0.0, net: 198, rev: 4752, delta: "−12.0%", cls: "neg" },
  ],
  ota_breakdown: [
    { sub: "Booking.com Standard", parent: "Booking.com", rms: 162, rev: 39402, promo: 0, delta: "+2.1%", cls: "pos" },
    { sub: "Booking.com Genius 10%", parent: "Booking.com", rms: 71, rev: 14342, promo: 100, delta: "+11.6%", cls: "pos" },
    { sub: "Booking.com Mobile 12%", parent: "Booking.com", rms: 35, rev: 5444, promo: 100, delta: "+5.4%", cls: "pos" },
    { sub: "Expedia Member", parent: "Expedia", rms: 38, rev: 8930, promo: 100, delta: "−1.8%", cls: "neg" },
    { sub: "Expedia Standard", parent: "Expedia", rms: 53, rev: 9816, promo: 0, delta: "−9.4%", cls: "neg" },
    { sub: "Agoda Insider", parent: "Agoda", rms: 22, rev: 4136, promo: 100, delta: "+1.2%", cls: "pos" },
    { sub: "Agoda Standard", parent: "Agoda", rms: 16, rev: 3008, promo: 0, delta: "−6.8%", cls: "neg" },
  ],
};

// ─── Rate plans ────────────────────────────────────────────────────────────
export const ratePlansData = {
  header: {
    title: "Rate plans",
    sub: "Performance · verdict · retire candidates",
    meta: "Source · CLOUDBEDS · 41 retire candidates flagged",
  },
  summary: [
    { l: "Active plans", v: "47", d: [{ vs: "trend", t: "of 88 total", c: "" }] },
    { l: "Top performer", v: "$58k", d: [{ vs: "BAR Direct", t: "best", c: "up" }] },
    { l: "Worst performer", v: "$0", d: [{ vs: "12 plans", t: "0 bookings", c: "down" }] },
    { l: "Total bookings", v: "859", d: [{ vs: "30d", t: "+11.4%", c: "up" }] },
  ],
  retire_candidates: 41,
  plans: [
    { id: "RP01", name: "BAR Flexible", channel: "Direct", bookings: 184, rooms: 391, adr: 245, days: 30, trend: 18.4, verdict: "keep", reason: "Top direct channel" },
    { id: "RP02", name: "BAR Refundable BDC", channel: "Booking.com", bookings: 162, rooms: 268, adr: 268, days: 30, trend: 4.2, verdict: "keep", reason: "Volume + parity safe" },
    { id: "RP03", name: "Genius 10%", channel: "Booking.com", bookings: 71, rooms: 142, adr: 241, days: 30, trend: 11.6, verdict: "keep", reason: "Mix booster, low erosion" },
    { id: "RP04", name: "Non-Refundable -15%", channel: "Direct", bookings: 38, rooms: 76, adr: 208, days: 30, trend: -2.1, verdict: "review", reason: "Cannibalising BAR" },
    { id: "RP05", name: "Expedia Member", channel: "Expedia", bookings: 38, rooms: 76, adr: 235, days: 30, trend: -1.8, verdict: "review", reason: "Margin slipping" },
    { id: "RP06", name: "DMC Tier-1", channel: "Wholesale", bookings: 24, rooms: 89, adr: 188, days: 30, trend: 1.1, verdict: "keep", reason: "Group anchor" },
    { id: "RP07", name: "Long-Stay 7+", channel: "Direct", bookings: 14, rooms: 112, adr: 178, days: 28, trend: 22.4, verdict: "keep", reason: "ALOS lift" },
    { id: "RP08", name: "Easter Promo (expired)", channel: "Direct", bookings: 0, rooms: 0, adr: 0, days: 0, trend: 0, verdict: "close", reason: "Past dates only" },
    { id: "RP09", name: "Spring Bloom 2025", channel: "Direct", bookings: 0, rooms: 0, adr: 0, days: 0, trend: 0, verdict: "close", reason: "Inactive 18 months" },
    { id: "RP10", name: "Old DMC Bulk", channel: "Wholesale", bookings: 0, rooms: 0, adr: 0, days: 0, trend: 0, verdict: "close", reason: "Contract expired" },
    { id: "RP11", name: "Last-Minute -10%", channel: "Direct", bookings: 9, rooms: 11, adr: 218, days: 22, trend: -8.4, verdict: "review", reason: "Low conversion" },
    { id: "RP12", name: "Honeymoon Package", channel: "Direct", bookings: 6, rooms: 24, adr: 312, days: 18, trend: 14.0, verdict: "keep", reason: "High ADR, growing" },
  ],
};

// ─── Pricing ───────────────────────────────────────────────────────────────
export const pricingData = {
  header: {
    title: "Pricing",
    sub: "BAR recommendations · OTB-aware floor logic · recommend-only",
    meta: "Source · PRICING AGENT · refreshed 8 min ago",
  },
  summary: [
    { l: "Recs queued", v: "5", d: [{ vs: "trend", t: "2 soft-floor", c: "warn" }] },
    { l: "Approved 7d", v: "11", d: [{ vs: "rate", t: "+3.2%", c: "up" }] },
    { l: "Avg Δ proposed", v: "+4.6%", d: [{ vs: "trend", t: "above floor", c: "up" }] },
    { l: "OTB blocks", v: "3", d: [{ vs: "trend", t: "active", c: "" }] },
  ],
  recs: [
    { id: "PR1", date: "2026-05-12", room: "Heritage Suite", cur: 410, prop: 442, delta: 7.8, flag: "ok", rationale: "Comp avg +6.2%, pace +18% ahead of STLY", signals: ["comp_set", "pace"], conf: "high", status: "pending", expires: "2026-05-08T18:00" },
    { id: "PR2", date: "2026-05-14", room: "River Bungalow", cur: 285, prop: 305, delta: 7.0, flag: "ok", rationale: "Group-anchored Thursday, 90% OTB", signals: ["pace", "events"], conf: "high", status: "pending", expires: "2026-05-08T18:00" },
    { id: "PR3", date: "2026-05-15", room: "Riverside Loft", cur: 250, prop: 248, delta: -0.8, flag: "soft_floor", rationale: "Pace −4% vs STLY, hold near floor", signals: ["pace", "trends"], conf: "medium", status: "pending", expires: "2026-05-08T18:00" },
    { id: "PR4", date: "2026-05-22", room: "Garden Studio", cur: 195, prop: 220, delta: 12.8, flag: "ok", rationale: "Local festival, 70% comp set sold-out", signals: ["events", "comp_set"], conf: "high", status: "pending", expires: "2026-05-09T18:00" },
    { id: "PR5", date: "2026-06-01", room: "Pool Villa", cur: 480, prop: 462, delta: -3.8, flag: "soft_floor", rationale: "Pace soft, but stay above floor of $455", signals: ["pace"], conf: "medium", status: "pending", expires: "2026-05-09T18:00" },
  ],
  floor_logic: {
    pace_threshold_pct: 5,
    days_to_arrival_threshold: 30,
    soft_floor_multiplier: 0.92,
    max_change_pct: 15,
    max_dates_per_cycle: 5,
    hard_floor: {
      "Garden Studio": "$155",
      "River Bungalow": "$220",
      "Riverside Loft": "$200",
      "Heritage Suite": "$340",
      "Pool Villa": "$455",
    },
  },
};

// ─── Comp set ──────────────────────────────────────────────────────────────
export const compSetData = {
  header: {
    title: "Comp set",
    sub: "7 competitors · 7-day forward grid · promo activity",
    meta: "Source · COMP SET SCANNER · last shop 12 min ago",
  },
  summary: [
    { l: "Our position", v: "#2 / 7", d: [{ vs: "trend", t: "above avg", c: "up" }] },
    { l: "vs comp avg", v: "+2.1%", d: [{ vs: "trend", t: "premium", c: "up" }] },
    { l: "Most aggressive", v: "Burasari", d: [{ vs: "promo", t: "67.8%", c: "warn" }] },
    { l: "Days since shop", v: "0", d: [{ vs: "freshness", t: "live", c: "up" }] },
  ],
  competitors: ["Burasari", "The Grand", "3 Nagas", "U Luang", "Maison Souvannaphoum", "Le Bel Air"],
  rate_grid: [
    { date: "2026-05-08", rates: [225, 268, 248, 295, 215, 232], avg: 247, ours: 262, delta: 6.1, source: "BDC", shopper: "PB", ts: "08:55" },
    { date: "2026-05-09", rates: [225, 268, 248, 295, 215, 232], avg: 247, ours: 268, delta: 8.5, source: "BDC", shopper: "PB", ts: "08:55" },
    { date: "2026-05-10", rates: [220, 258, 238, 285, 210, 226], avg: 240, ours: 260, delta: 8.4, source: "BDC", shopper: "PB", ts: "08:55" },
    { date: "2026-05-11", rates: [200, 248, 228, 275, 205, 218], avg: 229, ours: 245, delta: 7.0, source: "BDC", shopper: "PB", ts: "08:55" },
    { date: "2026-05-12", rates: [210, 258, 238, 285, 215, 226], avg: 239, ours: 255, delta: 6.7, source: "BDC", shopper: "PB", ts: "08:55" },
    { date: "2026-05-13", rates: [215, 268, 248, 295, 220, 232], avg: 246, ours: 268, delta: 8.9, source: "BDC", shopper: "PB", ts: "08:55" },
    { date: "2026-05-14", rates: [228, 285, 268, 308, 235, 248], avg: 262, ours: 285, delta: 8.8, source: "BDC", shopper: "PB", ts: "08:55" },
  ],
  promo: [
    { name: "Burasari Heritage", freq: 67.8, disc: 56.8, cls: "always_discounts", last: "2 min ago" },
    { name: "The Grand", freq: 38.2, disc: 22.4, cls: "frequent_promo", last: "15 min ago" },
    { name: "3 Nagas", freq: 14.6, disc: 12.8, cls: "occasional", last: "1h ago" },
    { name: "U Luang Prabang", freq: 21.4, disc: 18.0, cls: "occasional", last: "32 min ago" },
  ],
  source_config: { source: "scraper" as const, last_refresh: "2026-05-07 09:02 ICT", is_stale: false },
};

// ─── Parity ────────────────────────────────────────────────────────────────
export const parityData = {
  header: {
    title: "Parity",
    sub: "Open breaches · channels · Parity Watchdog feed",
    meta: "Source · PARITY WATCHDOG · last clean check 4 min ago",
  },
  summary: [
    { l: "Open breaches", v: "12", d: [{ vs: "trend", t: "+3 vs yest", c: "down" }] },
    { l: "Channels affected", v: "3", d: [{ vs: "trend", t: "BDC + 2", c: "warn" }] },
    { l: "Worst gap", v: "−12.0%", d: [{ vs: "BDC May 4", t: "critical", c: "down" }] },
    { l: "Hours since clean", v: "0.1h", d: [{ vs: "trend", t: "live", c: "up" }] },
  ],
  channels_monitored: ["Booking.com", "Expedia", "Agoda", "Direct"],
  breaches: [
    { id: "B01", det: "2026-05-07T09:13", ch: "Booking.com", date: "2026-05-04", our: 262, their: 230, delta: -12.2, status: "open", seen: "1 min ago" },
    { id: "B02", det: "2026-05-07T08:55", ch: "Booking.com", date: "2026-05-09", our: 268, their: 248, delta: -7.5, status: "open", seen: "19 min ago" },
    { id: "B03", det: "2026-05-07T08:42", ch: "Expedia", date: "2026-05-12", our: 255, their: 238, delta: -6.7, status: "open", seen: "32 min ago" },
    { id: "B04", det: "2026-05-07T08:14", ch: "Agoda", date: "2026-05-11", our: 245, their: 232, delta: -5.3, status: "open", seen: "1h ago" },
    { id: "B05", det: "2026-05-07T07:58", ch: "Booking.com", date: "2026-05-15", our: 285, their: 270, delta: -5.3, status: "acknowledged", seen: "1h 16m ago", by: "PB", at: "2026-05-07T08:01" },
    { id: "B06", det: "2026-05-07T06:30", ch: "Booking.com", date: "2026-05-18", our: 240, their: 228, delta: -5.0, status: "resolved", seen: "2h 44m ago", note: "Synced from Direct" },
    { id: "B07", det: "2026-05-06T22:15", ch: "Expedia", date: "2026-05-08", our: 262, their: 250, delta: -4.6, status: "open", seen: "10h ago" },
    { id: "B08", det: "2026-05-06T20:00", ch: "Booking.com", date: "2026-05-22", our: 305, their: 292, delta: -4.3, status: "open", seen: "13h ago" },
    { id: "B09", det: "2026-05-06T18:45", ch: "Agoda", date: "2026-05-13", our: 268, their: 258, delta: -3.7, status: "acknowledged", seen: "14h ago", by: "PB", at: "2026-05-06T19:00" },
    { id: "B10", det: "2026-05-06T15:10", ch: "Expedia", date: "2026-05-20", our: 285, their: 275, delta: -3.5, status: "open", seen: "18h ago" },
    { id: "B11", det: "2026-05-06T12:00", ch: "Booking.com", date: "2026-05-25", our: 320, their: 312, delta: -2.5, status: "open", seen: "21h ago" },
    { id: "B12", det: "2026-05-06T08:14", ch: "Booking.com", date: "2026-05-28", our: 295, their: 288, delta: -2.4, status: "open", seen: "1d ago" },
  ],
  agent: { id: "parity_watchdog", last_run: "1 min ago", next_run: "in 0 min", findings_24h: 18 },
};

// ─── Agents ────────────────────────────────────────────────────────────────
export const agentsData = {
  summary: [
    { l: "Active agents", v: "5", d: [{ vs: "of 6", t: "1 paused", c: "" }] },
    { l: "Findings 24h", v: "47", d: [{ vs: "rate", t: "+18%", c: "up" }] },
    { l: "Errors 24h", v: "0", d: [{ vs: "trend", t: "clean", c: "up" }] },
    { l: "Avg latency", v: "1.4s", d: [{ vs: "p95", t: "2.8s", c: "" }] },
  ],
  agents: [
    {
      id: "pace_pickup", name: "Pace & Pickup", status: "active",
      last_run: "3 min ago", next_run: "in 12 min", findings: 3,
      activity: [2, 1, 3, 2, 4, 3, 1, 2, 3, 2, 4, 5, 3, 2, 4, 3, 5, 4, 3, 2, 4, 3, 5, 4],
      actions: ["run_now", "pause", "settings", "view_logs"],
    },
    {
      id: "parity_watchdog", name: "Parity Watchdog", status: "active",
      last_run: "1 min ago", next_run: "in 0 min", findings: 12,
      activity: [4, 3, 5, 4, 6, 5, 4, 3, 4, 5, 6, 4, 5, 4, 6, 5, 4, 6, 5, 4, 5, 6, 5, 4],
      actions: ["run_now", "pause", "settings", "view_logs"],
    },
    {
      id: "compset_scanner", name: "Comp Set Scanner", status: "active",
      last_run: "12 min ago", next_run: "in 0 min", findings: 7,
      activity: [3, 4, 2, 3, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 4, 5, 4, 3, 5, 4],
      actions: ["run_now", "pause", "settings", "view_logs"],
    },
    {
      id: "rateplan_cleanup", name: "Rate Plan Cleanup", status: "idle",
      last_run: "2h ago", next_run: "in 22h", findings: 41,
      activity: [0, 0, 1, 0, 0, 1, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
      actions: ["run_now", "settings", "view_logs"],
    },
    {
      id: "forecast_engine", name: "Forecast Engine", status: "paused",
      last_run: "—", next_run: "—", findings: 0,
      activity: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      actions: ["resume", "settings", "view_logs"],
    },
    {
      id: "cancel_risk", name: "Cancellation Risk", status: "idle",
      last_run: "1h ago", next_run: "in 2h", findings: 7,
      activity: [1, 0, 1, 1, 0, 1, 2, 1, 0, 1, 1, 0, 2, 1, 0, 1, 1, 2, 1, 0, 1, 1, 0, 1],
      actions: ["run_now", "settings", "view_logs"],
    },
  ],
  recent: [
    { ts: "09:14", id: "parity_watchdog", type: "warning", msg: "Open breach: Booking.com −12.2% on 2026-05-04" },
    { ts: "09:13", id: "compset_scanner", type: "finding", msg: "Burasari Heritage promo activity 67.8% — always-discounts class" },
    { ts: "09:11", id: "pace_pickup", type: "finding", msg: "Pickup 7d ahead of STLY by +18%" },
    { ts: "09:08", id: "parity_watchdog", type: "warning", msg: "Open breach: Booking.com −7.5% on 2026-05-09" },
    { ts: "09:02", id: "compset_scanner", type: "success", msg: "7/7 properties shopped (BDC source, 14s)" },
    { ts: "08:55", id: "compset_scanner", type: "success", msg: "Rate grid refreshed for 2026-05-08 → 2026-05-14" },
    { ts: "08:42", id: "parity_watchdog", type: "warning", msg: "Open breach: Expedia −6.7% on 2026-05-12" },
    { ts: "08:14", id: "parity_watchdog", type: "warning", msg: "Open breach: Agoda −5.3% on 2026-05-11" },
    { ts: "07:58", id: "rateplan_cleanup", type: "finding", msg: "41 rate plans flagged retire (no bookings 18m+)" },
    { ts: "07:30", id: "pace_pickup", type: "success", msg: "Pace curve refreshed · STLY +18.4%" },
  ],
};
