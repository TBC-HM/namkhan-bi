// app/api/cockpit/approve-deploy/route.ts
// PBS 2026-05-09: route = task → staging → APPROVE → deploy.
// This endpoint is the APPROVE step. Given a deployment URL (or id) that's
// already on a Vercel preview, promote it to production via Vercel REST API.
// Caller passes either:
//   { ticket_id }                 — reads metadata.preview_url from the ticket
//   { bug_id }                    — reads fix_link / linked ticket's preview
//   { deployment_url, deployment_id? } — explicit
// On success: aliases the deploy to namkhan-bi.vercel.app + marks ticket
// completed + flips linked bug to done with fix_link = prod URL.

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const PROD_ALIAS = process.env.PROD_ALIAS ?? 'namkhan-bi.vercel.app';

interface VercelDeploymentLite {
  uid: string;
  url: string;
  state: string;
  target?: string;
}

async function vercelGet(path: string): Promise<unknown> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (VERCEL_TEAM_ID) url.searchParams.set('teamId', VERCEL_TEAM_ID);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!res.ok) throw new Error(`vercel ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function vercelPost(path: string, body: unknown): Promise<unknown> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (VERCEL_TEAM_ID) url.searchParams.set('teamId', VERCEL_TEAM_ID);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`vercel ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function resolveDeployment(input: {
  deployment_id?: string;
  deployment_url?: string;
}): Promise<VercelDeploymentLite> {
  if (input.deployment_id) {
    const d = await vercelGet(`/v13/deployments/${input.deployment_id}`);
    return d as VercelDeploymentLite;
  }
  if (input.deployment_url) {
    // Strip protocol + path so we can look up by URL.
    const host = input.deployment_url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const d = await vercelGet(`/v13/deployments/${encodeURIComponent(host)}`);
    return d as VercelDeploymentLite;
  }
  throw new Error('deployment_id or deployment_url required');
}

export async function POST(req: Request) {
  noStore();
  if (!VERCEL_TOKEN) {
    return NextResponse.json(
      { error: 'VERCEL_TOKEN env not set — cannot promote to production' },
      { status: 500 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    ticket_id?: number;
    bug_id?: number;
    deployment_url?: string;
    deployment_id?: string;
    approver?: string;
  };

  // Resolve deployment URL from inputs
  let deployment_url = body.deployment_url ?? null;
  let deployment_id = body.deployment_id ?? null;
  let ticket_id = body.ticket_id ?? null;
  let bug_id = body.bug_id ?? null;

  if (bug_id && !ticket_id) {
    const { data: bug } = await supabase
      .from('cockpit_bugs')
      .select('id, fix_link')
      .eq('id', bug_id)
      .single();
    if (bug?.fix_link && bug.fix_link.startsWith('https://')) {
      deployment_url = deployment_url ?? bug.fix_link;
    }
    // Find the linked ticket via metadata.cockpit_bug_id
    const { data: tickets } = await supabase
      .from('cockpit_tickets')
      .select('id, preview_url, metadata')
      .filter('metadata->>cockpit_bug_id', 'eq', String(bug_id))
      .order('id', { ascending: false })
      .limit(1);
    if (tickets && tickets.length > 0) {
      ticket_id = tickets[0].id;
      deployment_url = deployment_url ?? tickets[0].preview_url ?? null;
    }
  }
  if (ticket_id && !deployment_url) {
    const { data: t } = await supabase
      .from('cockpit_tickets')
      .select('preview_url, metadata')
      .eq('id', ticket_id)
      .single();
    if (t) {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      deployment_url =
        t.preview_url ?? (typeof meta.preview_url === 'string' ? meta.preview_url : null);
    }
  }
  if (!deployment_url && !deployment_id) {
    return NextResponse.json(
      { error: 'no deployment target — pass deployment_url, deployment_id, ticket_id (with preview_url), or bug_id (with linked ticket)' },
      { status: 400 },
    );
  }

  // Resolve and promote
  let target: VercelDeploymentLite;
  try {
    target = await resolveDeployment({ deployment_id: deployment_id ?? undefined, deployment_url: deployment_url ?? undefined });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  // Vercel "promote" pattern: alias the preview deployment to PROD_ALIAS.
  let aliasResult: unknown;
  try {
    aliasResult = await vercelPost(`/v2/deployments/${target.uid}/aliases`, {
      alias: PROD_ALIAS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `alias failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Audit + mark ticket completed + bug done.
  const prodUrl = `https://${PROD_ALIAS}`;
  if (ticket_id) {
    await supabase
      .from('cockpit_tickets')
      .update({
        status: 'completed',
        closed_at: new Date().toISOString(),
        preview_url: `https://${target.url}`,
        pr_url: `https://${target.url}`,
        notes: JSON.stringify({
          promoted_to: prodUrl,
          promoted_at: new Date().toISOString(),
          approver: body.approver ?? null,
          deployment_uid: target.uid,
        }),
      })
      .eq('id', ticket_id);
  }
  if (bug_id) {
    await supabase
      .from('cockpit_bugs')
      .update({
        status: 'done',
        done_at: new Date().toISOString(),
        fix_link: prodUrl,
        fix_label: `promoted by ${body.approver ?? 'PBS'} · ${target.uid.slice(0, 16)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bug_id);
  }
  await supabase.from('cockpit_audit_log').insert({
    agent: 'approve_deploy',
    action: 'promote_to_prod',
    success: true,
    ticket_id: ticket_id ?? null,
    notes: JSON.stringify({
      bug_id,
      deployment_uid: target.uid,
      prod_alias: PROD_ALIAS,
      approver: body.approver ?? null,
    }),
  });

  return NextResponse.json({
    ok: true,
    deployment_uid: target.uid,
    promoted_to: prodUrl,
    alias_result: aliasResult,
  });
}

export async function GET() {
  return NextResponse.json({
    name: 'approve-deploy',
    method: 'POST',
    body_schema: {
      ticket_id: 'number (optional)',
      bug_id: 'number (optional)',
      deployment_url: 'string (optional, e.g. namkhan-xyz.vercel.app)',
      deployment_id: 'string (optional, e.g. dpl_...)',
      approver: 'string (optional, defaults to PBS)',
    },
    note: 'Promotes a Vercel preview to production by aliasing it to PROD_ALIAS env (default namkhan-bi.vercel.app). Marks linked ticket completed + bug done.',
  });
}
