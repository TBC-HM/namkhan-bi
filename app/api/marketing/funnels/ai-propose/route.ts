import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SegmentKey = 'wellness' | 'couples' | 'culture' | 'welcome';

type FunnelStep = {
  step_no: number;
  delay_days: number;
  subject: string;
  body_md: string;
  click_tag_map: Record<string, string>;
};

type Funnel = {
  name: string;
  target_segment_key: string;
  steps: FunnelStep[];
};

const MODEL = 'claude-sonnet-4-6';

const BRAND_CONTEXT = `Namkhan is a riverside eco-retreat on the Nam Khan river outside Luang Prabang, Laos.
Origin: born as a permaculture farm; hospitality was grafted onto a working farm, not the other way around.
Property pillars:
- ROOTS restaurant: farm-to-table by definition, daily-picked, plant-forward, riverside terrace
- Jungle Spa: riverside yoga, Lao herbal compresses, ice bath, traditional Lao massage
- Riverside setting: quiet stretch of Nam Khan, jungle-fringed, walking distance to farm plots
- Retreats: Detox, Harmony & Mindfulness, Serene Couples, Immersion
Voice: grounded, unhurried, first-person-plural ("we"), sensory, never salesy. Never uses the word "discount".`;

const SEGMENT_TONE: Record<SegmentKey, string> = {
  wellness: 'Contemplative, body-aware, sensory. Lead with breath, herbs, water, silence. Speak to guests seeking recovery and rhythm.',
  couples: 'Intimate, warm, low-volume. Emphasise privacy, shared rituals, riverside evenings. Never cliché "romance-package" language.',
  culture: 'Curious, place-rooted. Lead with Luang Prabang, UNESCO old town, Mekong confluence, alms, weaving, cooking. Namkhan is base camp for the region.',
  welcome: 'Warm, unhurried welcome to a first-time guest who just discovered us. Story-first, sell-last.',
};

const WELCOME_SPEC = `Produce EXACTLY 4 steps for segment=welcome:
Step 1 (delay_days=0) subject "Welcome to the Farm" — deliver the Luang Prabang Slow-Travel Guide + permaculture origin story.
Step 2 (delay_days=3) subject "Built In, Not Bolted On" — Wellness & Jungle Spa: riverside yoga, Lao herbal compresses, ice bath.
Step 3 (delay_days=6) subject "Farm-to-Table, By Definition" — ROOTS restaurant: daily-picked, plant-forward, riverside terrace.
Step 4 (delay_days=10) subject "Find Your Sanctuary" — accommodation tiers + Immersion Retreats. Soft incentive: complimentary 60-min traditional Lao massage upgrade (NOT a discount).`;

const TAG_CHEATSHEET = `click_tag_map maps URL slug -> tag key. Cheat-sheet:
- wellness triggers: spa, detox, yoga, wellness, ice-bath, herbal
- couples triggers: couples, romance, private-villa, intimate, honeymoon
- culture triggers: unesco, mekong, kayak, cooking, tour, old-town
Every step MUST include a click_tag_map with 3-6 entries drawn from the pillars mentioned in that step's body_md.`;

function fallbackWelcome(): Funnel {
  return {
    name: 'Welcome — Namkhan First-Timer',
    target_segment_key: 'welcome',
    steps: [
      {
        step_no: 1,
        delay_days: 0,
        subject: 'Welcome to the Farm',
        body_md: `We started as a permaculture farm on the Nam Khan river. The hotel came later — grafted onto the farm, not the other way around.\n\nAs a small welcome, here is our **Luang Prabang Slow-Travel Guide** — the walks, the mornings, the quiet corners we send friends to.\n\n[Download the guide](https://namkhan.com/guide)\n\nSee you by the river,\nThe Namkhan Farm`,
        click_tag_map: { 'guide': 'culture', 'permaculture': 'wellness', 'old-town': 'culture' },
      },
      {
        step_no: 2,
        delay_days: 3,
        subject: 'Built In, Not Bolted On',
        body_md: `Our Jungle Spa was not designed as an amenity. It grew out of what the farm already made — Lao herbs, river water, morning light.\n\n- **Riverside yoga** at first light\n- **Lao herbal compresses** steamed from farm-grown lemongrass, ginger, kaffir\n- **Ice bath** on the river bank\n\n[Explore the Jungle Spa](https://namkhan.com/jungle-spa)`,
        click_tag_map: { 'jungle-spa': 'wellness', 'yoga': 'wellness', 'herbal': 'wellness', 'ice-bath': 'wellness' },
      },
      {
        step_no: 3,
        delay_days: 6,
        subject: 'Farm-to-Table, By Definition',
        body_md: `**ROOTS** is not a farm-to-table concept. It is a farm-to-table fact.\n\nWhat is picked in the morning is on the terrace by evening. Plant-forward, seasonal, quiet. Eaten looking at the Nam Khan.\n\n[See the ROOTS kitchen](https://namkhan.com/roots)`,
        click_tag_map: { 'roots': 'wellness', 'cooking': 'culture', 'detox': 'wellness' },
      },
      {
        step_no: 4,
        delay_days: 10,
        subject: 'Find Your Sanctuary',
        body_md: `When you are ready, there is a room with your name on it.\n\n- **Farm Rooms** — closest to the gardens\n- **Riverside Suites** — first light on the Nam Khan\n- **Immersion Retreats** — Detox, Harmony & Mindfulness, Serene Couples, Immersion\n\nBook direct and we will upgrade your stay with a **complimentary 60-minute traditional Lao massage** on arrival — our welcome, not a discount.\n\n[Find your sanctuary](https://namkhan.com/stay)`,
        click_tag_map: { 'stay': 'wellness', 'couples-retreat': 'couples', 'immersion': 'wellness', 'private-villa': 'couples' },
      },
    ],
  };
}

function buildPrompt(segment: SegmentKey, customBrief?: string): string {
  const toneLine = SEGMENT_TONE[segment];
  const specBlock = segment === 'welcome' ? WELCOME_SPEC : `Produce 3-5 steps tuned to segment=${segment}. First step delay_days=0. Subsequent delays spaced 3-5 days apart.`;
  const briefBlock = customBrief ? `\nOperator brief (must respect): ${customBrief}\n` : '';
  return `${BRAND_CONTEXT}

Segment: ${segment}
Tone: ${toneLine}
${briefBlock}
${specBlock}

${TAG_CHEATSHEET}

Return ONLY valid JSON matching:
{
  "name": string,
  "target_segment_key": "${segment}",
  "steps": [
    { "step_no": number, "delay_days": number, "subject": string, "body_md": string, "click_tag_map": { [slug: string]: string } }
  ]
}
body_md is markdown, 120-260 words per step, sensory, first-person-plural, no discount language.`;
}

async function callClaude(prompt: string): Promise<Funnel> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text: string = j?.content?.[0]?.text ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no json in claude response');
  return JSON.parse(text.slice(start, end + 1)) as Funnel;
}

export async function POST(req: NextRequest) {
  let body: { segment?: SegmentKey; custom_brief?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const segment = body.segment;
  if (!segment || !['wellness', 'couples', 'culture', 'welcome'].includes(segment)) {
    return NextResponse.json({ ok: false, error: 'segment must be wellness|couples|culture|welcome' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const funnel = segment === 'welcome' ? fallbackWelcome() : { ...fallbackWelcome(), target_segment_key: segment, name: `Fallback — ${segment}` };
    return NextResponse.json({ ok: true, funnel, stub: true });
  }

  try {
    const funnel = await callClaude(buildPrompt(segment, body.custom_brief));
    if (!funnel?.steps?.length) throw new Error('empty_funnel');
    return NextResponse.json({ ok: true, funnel });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'claude_failed' }, { status: 502 });
  }
}
