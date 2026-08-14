#!/usr/bin/env node
/**
 * scripts/refresh-inventory.ts
 * 
 * Parses vercel.json crons and .github/workflows/*.yml schedules,
 * upserts them into governance.scheduled_work_inventory via PostgREST.
 * 
 * Part of cost-gov-findings-slice-kill-switch-coverage (item 2, slice D).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import * as yaml from 'js-yaml';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('FATAL: missing supabase env');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

interface InventoryRow {
  scheduler: 'vercel_cron' | 'github_actions';
  identifier: string;
  schedule_expr: string;
  target: string;
  can_spend_tokens: boolean;
  gated: boolean;
  notes: string;
}

async function parseVercelJson(): Promise<InventoryRow[]> {
  console.log('Parsing vercel.json...');
  const raw = readFileSync('vercel.json', 'utf-8');
  const config = JSON.parse(raw);
  const rows: InventoryRow[] = [];

  if (!config.crons) return rows;

  for (const cron of config.crons) {
    const path = cron.path as string;
    const schedule = cron.schedule as string;
    const identifier = path.split('/').pop() || path;

    // Check if route file has automation check (heuristic: file contains 'fn_automation_enabled')
    let gated = false;
    let can_spend_tokens = false;

    try {
      const routePath = `app${path}/route.ts`;
      const routeContent = readFileSync(routePath, 'utf-8');
      gated = routeContent.includes('fn_automation_enabled');
      
      // Token-spending heuristic: calls Anthropic/OpenAI
      can_spend_tokens = routeContent.includes('anthropic.com') || 
                         routeContent.includes('openai.com') ||
                         routeContent.includes('ANTHROPIC_API_KEY') ||
                         routeContent.includes('OPENAI_API_KEY');
    } catch (err) {
      console.warn(`Could not read route file for ${path}:`, err);
    }

    rows.push({
      scheduler: 'vercel_cron',
      identifier,
      schedule_expr: schedule,
      target: path,
      can_spend_tokens,
      gated,
      notes: gated ? 'Has kill-switch check' : 'No kill-switch check detected',
    });
  }

  console.log(`Found ${rows.length} Vercel cron(s)`);
  return rows;
}

async function parseGitHubWorkflows(): Promise<InventoryRow[]> {
  console.log('Parsing .github/workflows/*.yml...');
  const rows: InventoryRow[] = [];
  const workflowDir = '.github/workflows';
  const files = readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const fullPath = `${workflowDir}/${file}`;
    const content = readFileSync(fullPath, 'utf-8');
    
    let workflow: any;
    try {
      workflow = yaml.load(content);
    } catch (err) {
      console.warn(`Failed to parse ${file}:`, err);
      continue;
    }

    if (!workflow.on?.schedule) continue;

    const schedules = workflow.on.schedule;
    if (!Array.isArray(schedules) || schedules.length === 0) continue;

    const schedule = schedules[0].cron; // take first schedule if multiple
    const identifier = file.replace(/\.(yml|yaml)$/, '');

    // Check if workflow calls a script that has automation check
    let gated = false;
    let can_spend_tokens = false;

    // Heuristic: if workflow runs runner-v3.ts or similar, it's gated and can spend
    if (content.includes('runner-v3.ts') || content.includes('brief-builder-agent.ts')) {
      gated = true;
      can_spend_tokens = true;
    }

    // Additional heuristic: check if any step mentions automation check
    if (content.includes('fn_automation_enabled') || content.includes('checkAutomation')) {
      gated = true;
    }

    rows.push({
      scheduler: 'github_actions',
      identifier,
      schedule_expr: schedule,
      target: `.github/workflows/${file}`,
      can_spend_tokens,
      gated,
      notes: gated ? 'Has kill-switch check' : 'No kill-switch check detected',
    });
  }

  console.log(`Found ${rows.length} GitHub Action schedule(s)`);
  return rows;
}

async function upsertRows(rows: InventoryRow[]) {
  console.log(`Upserting ${rows.length} row(s)...`);
  let successCount = 0;

  for (const row of rows) {
    const { data, error } = await supa.rpc('fn_scheduled_work_upsert_external', {
      p_scheduler: row.scheduler,
      p_identifier: row.identifier,
      p_schedule_expr: row.schedule_expr,
      p_target: row.target,
      p_can_spend_tokens: row.can_spend_tokens,
      p_gated: row.gated,
      p_notes: row.notes,
    });

    if (error) {
      console.error(`Failed to upsert ${row.scheduler}/${row.identifier}:`, error.message);
    } else {
      console.log(`✓ ${row.scheduler}/${row.identifier} → id=${data}`);
      successCount++;
    }
  }

  console.log(`${successCount}/${rows.length} upserted successfully`);
}

async function main() {
  const vercelRows = await parseVercelJson();
  const ghaRows = await parseGitHubWorkflows();
  const allRows = [...vercelRows, ...ghaRows];

  if (allRows.length === 0) {
    console.log('No scheduled work found');
    return;
  }

  await upsertRows(allRows);
  console.log('Inventory refresh complete');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
