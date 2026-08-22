// middleware.ts  —  repo root (TBC-HM/namkhan-bi)
// ADR-112 · Supabase Auth gate + property access check.
// PBS 2026-07-09: Buffer->atob (Edge runtime lacks Buffer). base64url payload
// decoded via atob after '-->+' / '_-->/' swap + right-pad. /api/* returns 401 JSON
// instead of HTML redirect. holding_role stamped by custom_access_token_hook.
// PBS 2026-07-14: auto-connect Gmail for @thenamkhan.com on first authenticated
// page load. If the user is signed in with a namkhan email and has no active
// row in public.v_user_gmail_connections, redirect once to /api/user/gmail/connect
// so the OAuth consent flow completes automatically. Idempotent - once the row
// exists (active=true) we never redirect again; expired access tokens refresh
// silently via lib/userGmail helpers.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Signed public links + auth entry points stay open.
// /api/cron uses CRON_SECRET header; /api/cockpit/webhooks uses per-vendor signature.
// PBS 2026-07-09: /account/password is public so first-time invitees can
// reach the activation page with their token before they have a session cookie.
// The page itself validates the token and refuses if it's missing/expired.
// PBS 2026-07-16: /subscriber/confirm/[token] is the public newsletter opt-in
// confirmation landing (single-purpose page; token = only auth surface).
// PBS brief dataroom-module-v1 (2026-07-30): /room/[token] is the external
// data-room guest surface — token-only auth (per-request grant re-validation
// inside fn_dataroom_guest_* RPCs), zero platform navigation. /api/room/ is
// its serving API. Pattern mirrors /p/ (proposals).
const PUBLIC_PATHS = ['/login', '/auth/callback', '/account/password', '/p/', '/subscriber/confirm/', '/room/']

// base64url -> JSON. Edge-safe (no Buffer / no Node crypto).
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4))
  try { return JSON.parse(atob(pad)) } catch { return {} }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // PBS 2026-08-21 · URL LAW: bare /operations/* → tenant-scoped /h/260955/operations/*
  // Bare pages exist as Namkhan-only bodies; tenant chrome (Marketing/Ops sub-strip +
  // ThemeInjector) only renders under /h/[property_id]/*. Redirect runs BEFORE auth
  // so the login-redirect `next` param carries the tenant URL — no double bounce.
  //
  // EXCLUSION: 14 bare paths where the BARE page is the Namkhan-canonical body
  // and the tenant delegate self-redirects Namkhan back to bare (USD/Cloudbeds vs
  // EUR/Mews duality). Redirecting bare→tenant here would create an infinite loop.
  const BARE_CANONICAL_OPS = new Set([
    '/operations',
    '/operations/overview',
    '/operations/menus', '/operations/suppliers', '/operations/rooms',
    '/operations/other', '/operations/retail', '/operations/activities',
    '/operations/transport', '/operations/restaurant',
    '/operations/spa', '/operations/spa/passes', '/operations/spa/schedule',
    '/operations/spa/delivery', '/operations/spa/catalogue',
  ]);
  if (
    (pathname === '/operations' || pathname.startsWith('/operations/')) &&
    !BARE_CANONICAL_OPS.has(pathname)
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/h/260955' + pathname
    return NextResponse.redirect(url, 307)
  }

  // Same URL LAW for /guest/* — only the /guest HoD page is Namkhan-canonical
  // (tenant page self-redirects Namkhan back). All sub-pages are safe to redirect.
  const BARE_CANONICAL_GUEST = new Set(['/guest']);
  if (
    (pathname === '/guest' || pathname.startsWith('/guest/')) &&
    !BARE_CANONICAL_GUEST.has(pathname)
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/h/260955' + pathname
    return NextResponse.redirect(url, 307)
  }

  // /finance URL LAW · same pattern as /operations + /guest.
  // Tenant self-redirects for /finance, /finance/hr, /finance/pnl.
  const BARE_CANONICAL_FINANCE = new Set(['/finance', '/finance/hr', '/finance/pnl']);
  if (
    (pathname === '/finance' || pathname.startsWith('/finance/')) &&
    !BARE_CANONICAL_FINANCE.has(pathname)
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/h/260955' + pathname
    return NextResponse.redirect(url, 307)
  }

  // /sales URL LAW · bare-canonical: /sales HoD + /sales/icp
  const BARE_CANONICAL_SALES = new Set(['/sales', '/sales/icp']);
  if (
    (pathname === '/sales' || pathname.startsWith('/sales/')) &&
    !BARE_CANONICAL_SALES.has(pathname)
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/h/260955' + pathname
    return NextResponse.redirect(url, 307)
  }

  // /marketing URL LAW · bare-canonical: HoD + website + youtube + socials-legacy
  const BARE_CANONICAL_MARKETING = new Set([
    '/marketing', '/marketing/website', '/marketing/socials',
    // /marketing/youtube kept bare-canonical for now — tenant page self-redirects.
    '/marketing/youtube',
  ]);
  if (
    (pathname === '/marketing' || pathname.startsWith('/marketing/')) &&
    !BARE_CANONICAL_MARKETING.has(pathname) &&
    !pathname.startsWith('/marketing/youtube/')  // youtube subroutes also bare
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/h/260955' + pathname
    return NextResponse.redirect(url, 307)
  }

  // /revenue URL LAW · bare-canonical: parity + pricing + briefing + rateplans/dead
  const BARE_CANONICAL_REVENUE = new Set([
    '/revenue/parity', '/revenue/pricing', '/revenue/briefing',
    '/revenue/rateplans/dead',
  ]);
  if (
    (pathname === '/revenue' || pathname.startsWith('/revenue/')) &&
    !BARE_CANONICAL_REVENUE.has(pathname)
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/h/260955' + pathname
    return NextResponse.redirect(url, 307)
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cockpit/webhooks') ||
    pathname.startsWith('/api/cockpit/docs/backup') || // CI pre-deploy backup
    pathname.startsWith('/api/cockpit/health-sweep') || // bug #157 2026-08-03: cron job 188 — internal Bearer gate lives inside the route
    pathname.startsWith('/api/auth/') || // login / request-access / callback exchange
    pathname.startsWith('/api/marketing/media/preview') || // PBS 2026-07-14
    pathname.startsWith('/api/marketing/contacts/extract') || // PBS 2026-07-16 · cron+admin gate lives inside the route
    pathname.startsWith('/api/marketing/gmail/scan-replies') ||
    pathname.startsWith('/api/newsletter/refire-broadcasts') || // refire-broadcasts — x-cron-secret gate inside route // newsletter-owner-test-feedback-writer-v1 2026-08-01 · job 153 was middleware-401-dead (4th silent-401); x-cron-secret gate lives inside the route
    pathname.startsWith('/api/marketing/gmail/extract-shared/') || // same fix family 2026-08-01 · job 152 (extract-shared/process) was middleware-401-dead; internal gate lives inside the route
    pathname.startsWith('/api/public/') || // PBS 2026-07-16 (Feature B): public guest confirmation POST
    pathname.startsWith('/api/sales/leads/webhook') || // sales brief A7 2026-07-30: vendor webhook — x-webhook-secret gate lives inside the route
    pathname.startsWith('/api/sales/prospects/import') || // sales brief A7 2026-07-30: server-to-server import — secret gate lives inside the route
    pathname.startsWith('/api/p/') || // PBS 2026-07-16: guest-side /p/[token] view + block tracking
    pathname.startsWith('/api/room/') || // dataroom-module-v1: guest item view/download (token-gated in route)
    pathname === '/api/website/sitemap.xml' || // website-module-v1-slice-cms4-seo: public crawler access (protected_path_decisions id=7)
    pathname === '/api/website/robots.txt' || // website-module-v1-slice-cms4-seo: public crawler access (protected_path_decisions id=7)
    PUBLIC_PATHS.some(p => pathname.startsWith(p))
  ) return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c) => { c.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'auth required' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? decodeJwtPayload(session.access_token) : {}
  const holdingRole: string = String(claims.holding_role ?? '')
  const propertyIds: number[] = Array.isArray(claims.property_ids)
    ? (claims.property_ids as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : []

  const m = pathname.match(/^\/h\/(\d+)(\/|$)/)
  if (m) {
    const pid = Number(m[1])
    const allowed = holdingRole !== '' || propertyIds.includes(pid)
    if (!allowed) return new NextResponse('Forbidden -- no access to this property', { status: 403 })
  }

  if (pathname.startsWith('/holding') && holdingRole === '') {
    return new NextResponse('Forbidden -- holding access only', { status: 403 })
  }

  // -------- Auto-connect Gmail for @thenamkhan.com staff --------
  // Only fires on top-level HTML page loads. Never on API routes (would break
  // fetch calls with unexpected 302s), never on the Gmail connect / callback
  // path itself (would loop), never on /settings/gmail (user needs to see the
  // error-state toast if consent was declined).
  const email = (user.email ?? '').toLowerCase()
  const isNamkhanStaff = email.endsWith('@thenamkhan.com')
  const isApiRoute = pathname.startsWith('/api/')
  const isGmailPath = pathname.startsWith('/api/user/gmail') || pathname.startsWith('/settings/gmail')
  if (isNamkhanStaff && !isApiRoute && !isGmailPath) {
    const { data: connections, error: connErr } = await supabase
      .from('v_user_gmail_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()
    if (!connErr && !connections) {
      const url = req.nextUrl.clone()
      url.pathname = '/api/user/gmail/connect'
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

