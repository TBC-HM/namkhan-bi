// app/holding/it2/fleet/_lib/Diagrams.tsx
// loops-audit-v1 slice 2 (2026-08-07) — the notation, rendered.
//
// Purpose: let PBS read a chain / loop / hybrid at a glance and see WHERE they
// break. The numbered markers correspond 1:1 to the failure table on
// /fleet/loops. Server components — inline SVG, no client JS, no deps.
//
// Design rule held here: the failures live on the ARROWS and the DIAMOND, not
// in the boxes. The boxes are the part people already look at.

import { TOKENS, MONO } from '@/components/cockpit/tokens';

const INK = TOKENS.ink;
const SOFT = TOKENS.text2;
const LINE = '#B8A878';
const BOX = '#FFFFFF';
const BORDER = TOKENS.border;
const RED = TOKENS.terracotta;
const OK = '#1F7A4D';
const AMBER = '#B8860B';

function Marker({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill={RED} />
      <text x={x} y={y + 3.5} fontSize={10} fontWeight={700} textAnchor="middle" fill="#FFF" fontFamily={MONO}>
        {n}
      </text>
    </g>
  );
}

function Box({ x, y, w, h, title, sub, stroke }: { x: number; y: number; w: number; h: number; title: string; sub?: string; stroke?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={BOX} stroke={stroke ?? BORDER} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 2 : h / 2 + 4)} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={INK}>
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} fontSize={9.5} textAnchor="middle" fill={SOFT}>
          {sub}
        </text>
      )}
    </g>
  );
}

const arrowDefs = (
  <defs>
    <marker id="lc-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
      <path d="M0,0 L0,6 L7,3 z" fill={LINE} />
    </marker>
    <marker id="lc-arrow-ok" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
      <path d="M0,0 L0,6 L7,3 z" fill={OK} />
    </marker>
  </defs>
);

const capStyle: React.CSSProperties = {
  fontSize: 10.5, color: SOFT, margin: '4px 0 0', lineHeight: 1.4,
};

export function ChainDiagram() {
  return (
    <div>
      <svg viewBox="0 0 560 116" width="100%" style={{ display: 'block' }} role="img" aria-label="Chain diagram: input to extract to map to write to done, with three failure points on the arrows">
        {arrowDefs}
        <text x={0} y={12} fontSize={10} fontWeight={700} fill={SOFT} letterSpacing="0.06em">CHAIN — runs once, ends</text>
        <Box x={4} y={34} w={78} h={40} title="input" />
        <Box x={122} y={28} w={92} h={52} title="A · extract" sub="Cloudbeds pull" />
        <Box x={254} y={28} w={92} h={52} title="B · map" sub="USALI accounts" />
        <Box x={386} y={28} w={92} h={52} title="C · write" sub="Supabase upsert" />
        <Box x={506} y={34} w={50} h={40} title="done" stroke={OK} />
        <line x1={84} y1={54} x2={116} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={216} y1={54} x2={248} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={348} y1={54} x2={380} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={480} y1={54} x2={500} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <Marker x={232} y={54} n={1} />
        <Marker x={364} y={54} n={2} />
        <Marker x={432} y={98} n={3} />
        <line x1={432} y1={82} x2={432} y2={88} stroke={RED} strokeWidth={1.6} />
      </svg>
      <p style={capStyle}>
        Finite. Breaks at the <strong>arrows</strong> — the handoffs — not in the boxes.
      </p>
    </div>
  );
}

export function LoopDiagram() {
  return (
    <div>
      <svg viewBox="0 0 560 150" width="100%" style={{ display: 'block' }} role="img" aria-label="Loop diagram: seed to work step to verify to exit decision, with a feedback arrow and three failure points">
        {arrowDefs}
        <text x={0} y={12} fontSize={10} fontWeight={700} fill={SOFT} letterSpacing="0.06em">LOOP — repeats until an exit test fires</text>
        <Box x={4} y={34} w={68} h={40} title="seed" />
        <Box x={110} y={28} w={104} h={52} title="work step" sub="fix exceptions" />
        <Box x={254} y={28} w={92} h={52} title="verify" sub="machine-checkable" />
        <path d="M392,54 L428,28 L464,54 L428,80 z" fill={BOX} stroke={AMBER} strokeWidth={1.4} />
        <text x={428} y={51} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={AMBER}>exit?</text>
        <text x={428} y={64} fontSize={8} textAnchor="middle" fill={SOFT}>5 tests</text>
        <Box x={500} y={34} w={56} h={40} title="done" stroke={OK} />
        <line x1={74} y1={54} x2={104} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={216} y1={54} x2={248} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={348} y1={54} x2={386} y2={54} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={466} y1={54} x2={494} y2={54} stroke={OK} strokeWidth={1.6} markerEnd="url(#lc-arrow-ok)" />
        <text x={480} y={46} fontSize={9} textAnchor="middle" fill={OK}>yes</text>
        <path d="M428,82 L428,112 L162,112 L162,84" fill="none" stroke={LINE} strokeWidth={1.6} strokeDasharray="4 3" markerEnd="url(#lc-arrow)" />
        <text x={296} y={126} fontSize={9.5} textAnchor="middle" fill={SOFT}>no — iterate with updated state</text>
        <Marker x={300} y={98} n={4} />
        <Marker x={162} y={140} n={5} />
        <Marker x={428} y={140} n={6} />
      </svg>
      <p style={capStyle}>
        Needs <strong>2 or more exit conditions</strong>: success · convergence · hard max-iter ·
        budget (guard, never primary) · drain-rate for cron-paced loops.
      </p>
    </div>
  );
}

export function HybridDiagram() {
  return (
    <div>
      <svg viewBox="0 0 560 132" width="100%" style={{ display: 'block' }} role="img" aria-label="Hybrid diagram: scout, then a boxed loop of fix and check, then publish, with one failure point at the exit">
        {arrowDefs}
        <text x={0} y={12} fontSize={10} fontWeight={700} fill={SOFT} letterSpacing="0.06em">HYBRID — a chain with one looping stage (most of this platform)</text>
        <Box x={4} y={36} w={86} h={48} title="scout" sub="build work-list" />
        <rect x={116} y={22} width={276} height={80} rx={8} fill="none" stroke={LINE} strokeDasharray="5 4" />
        <text x={254} y={18} fontSize={9} textAnchor="middle" fill={LINE}>LOOP · per item, until clean</text>
        <Box x={130} y={36} w={110} h={48} title="fix" sub="agent + named skill" />
        <Box x={266} y={36} w={110} h={48} title="check" sub="0 exceptions?" />
        <path d="M321,86 L321,96 L185,96 L185,86" fill="none" stroke={LINE} strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#lc-arrow)" />
        <Box x={444} y={36} w={104} h={48} title="publish" sub="write + log ADR" />
        <line x1={92} y1={60} x2={124} y2={60} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={242} y1={60} x2={260} y2={60} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <line x1={394} y1={60} x2={438} y2={60} stroke={LINE} strokeWidth={1.6} markerEnd="url(#lc-arrow)" />
        <Marker x={416} y={60} n={7} />
      </svg>
      <p style={capStyle}>
        The chain continues regardless of <em>why</em> the loop stopped. Gate the next step on{' '}
        <code>exit_reason = success</code>, or publish runs on half-fixed data.
      </p>
    </div>
  );
}
