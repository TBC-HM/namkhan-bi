// app/api/google/oauth/connect/route.ts
// PBS 2026-07-03: kicks off Google Business Profile OAuth.
// Visit /api/google/oauth/connect?property=260955 to start.

import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = '573294310855-fpfoprn101pjpp5fvr3eavdk0d0ml52i.apps.googleusercontent.com';
const REDIRECT  = 'https://namkhan-bi.vercel.app/api/google/oauth/callback';
const SCOPE     = 'https://www.googleapis.com/auth/business.manage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const propertyID = req.nextUrl.searchParams.get('property') ?? '260955';
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',     CLIENT_ID);
  url.searchParams.set('redirect_uri',  REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope',         SCOPE);
  url.searchParams.set('access_type',   'offline');
  url.searchParams.set('prompt',        'consent');
  url.searchParams.set('state',         propertyID);
  return NextResponse.redirect(url.toString(), 302);
}
