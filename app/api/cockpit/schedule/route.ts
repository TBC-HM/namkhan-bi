// app/api/cockpit/schedule/route.ts
// Lists scheduled jobs. Reads:
//   1. .github/workflows/*.yml in the repo (parsed for cron triggers)
//   2. Make.com scenarios with cron triggers (via Make API)

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type ScheduleItem = {
  name: string;
  cron: string;
  source: "github" | "make";
  nextRun: string | null;
  lastStatus: string | null;
};

export async function GET() {
  const items: ScheduleItem[] = [];

  // 1. GitHub Actions — read workflow files at build time
  try {
    const workflowDir = path.join(process.cwd(), ".github/workflows");
    const files = await fs.readdir(workflowDir).catch(() => []);
    for (const f of files) {
      if (!f.endsWith(".yml") && !f.endsWith(".yaml")) continue;
      const content = await fs.readFile(path.join(workflowDir, f), "utf-8");
      const cronMatches = content.matchAll(/cron:\s*['"]([^'"]+)['"]/g);
      for (const m of cronMatches) {
        items.push({
          name: f.replace(/\.ya?ml$/, ""),
          cron: m[1],
          source: "github",
          nextRun: nextCronRun(m[1]),
          lastStatus: null,
        });
      }
    }
  } catch (e) {
    console.error("schedule github", e);
  }

  // 2. Make.com scenarios — call Make API if MAKE_API_TOKEN env is set
  if (process.env.MAKE_API_TOKEN && process.env.MAKE_TEAM_ID) {
    try {
      const res = await fetch(
        `https://eu1.make.com/api/v2/scenarios?teamId=${process.env.MAKE_TEAM_ID}`,
        { headers: { Authorization: `Token ${process.env.MAKE_API_TOKEN}` } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const s of data.scenarios ?? []) {
          if (s.scheduling?.type === "indefinitely" && s.scheduling?.interval) {
            items.push({
              name: s.name,
              cron: `every ${s.scheduling.interval}s`,
              source: "make",
              nextRun: s.nextExec ?? null,
              lastStatus: s.isActive ? "active" : "paused",
            });
          }
        }
      }
    } catch (e) {
      console.error("schedule make", e);
    }
  }

  return NextResponse.json({ items });
}

function nextCronRun(_cron: string): string | null {
  // Lightweight placeholder. Use cron-parser package for accurate calc.
  // npm i cron-parser then: const interval = parseExpression(cron); return interval.next().toString();
  return null;
}
