import { NextResponse } from 'next/server';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? '';
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN ?? '';

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function countMessages(accessToken: string, query: string): Promise<number> {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: '500' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail API error: ${text}`);
    }
    const data = await res.json() as { messages?: unknown[]; nextPageToken?: string; resultSizeEstimate?: number };
    total += data.messages?.length ?? 0;
    pageToken = data.nextPageToken;
  } while (pageToken);
  return total;
}

export async function GET() {
  try {
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Gmail OAuth credentials not configured' },
        { status: 500 }
      );
    }

    const accessToken = await getAccessToken();

    // Gmail search uses unix epoch seconds for after:/before:
    const nowSec = Math.floor(Date.now() / 1000);
    const oneDayAgoSec = nowSec - 86400;

    const [emailsIn, emailsOut] = await Promise.all([
      countMessages(accessToken, `in:inbox after:${oneDayAgoSec}`),
      countMessages(accessToken, `in:sent after:${oneDayAgoSec}`),
    ]);

    return NextResponse.json({ emailsIn, emailsOut, windowHours: 24 });
  } catch (err) {
    console.error('[gmail/stats]', err);
    return NextResponse.json(
      { error: String(err), emailsIn: null, emailsOut: null },
      { status: 500 }
    );
  }
}
