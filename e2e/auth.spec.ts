// e2e/auth.spec.ts
// ADR-112 critical-path e2e — unauthenticated access to a property-scoped
// route must redirect to /login with a ?next= preserving the original path.
// Project rule: critical-path e2e is a hard requirement for auth changes.
//
// Run locally: npx playwright test e2e/auth.spec.ts
// (Requires @playwright/test in devDependencies + a playwright.config.ts.)

import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test('unauthenticated /h/260955/finance redirects to /login with ?next=', async ({ page }) => {
  // Belt-and-braces: discard any prior session cookies for a clean run.
  await page.context().clearCookies();

  const target = '/h/260955/finance';
  const resp = await page.goto(`${BASE}${target}`, { waitUntil: 'domcontentloaded' });

  // Final URL must be /login with ?next encoding the original target.
  const finalUrl = new URL(page.url());
  expect(finalUrl.pathname).toBe('/login');
  expect(finalUrl.searchParams.get('next')).toBe(target);

  // Page must show the login form (button label + email input present).
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await expect(page.getByPlaceholder('email')).toBeVisible();
  await expect(page.getByPlaceholder('password')).toBeVisible();

  // The redirect itself should resolve 200 (login page loaded).
  // (resp.status() reflects the LAST navigation in the chain — the /login GET.)
  expect(resp && resp.status()).toBe(200);
});
