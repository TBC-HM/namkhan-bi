# Code Standards

## Languages

- **TypeScript** preferred for all new code
- **JavaScript** only when extending existing JS files
- **Python** for data scripts, ETL, agent tooling
- **SQL** for Supabase migrations and queries

## File organization

- One responsibility per file
- Co-locate tests with source: `Foo.tsx` + `Foo.test.tsx`
- Co-locate types: prefer inline or in same file unless shared
- Shared types in `/types/` or `/lib/types/`

## Naming

| Item | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `BookingCard.tsx` |
| Files (utilities) | kebab-case | `currency-convert.ts` |
| Variables, functions | camelCase | `calculateRevPar` |
| Components | PascalCase | `BookingCard` |
| Constants | SCREAMING_SNAKE | `MAX_GUESTS` |
| Types, interfaces | PascalCase | `BookingPayload` |
| DB tables | snake_case | `bookings`, `kpi_snapshots` |
| DB columns | snake_case | `created_at`, `revenue_lak` |

## React patterns

- Functional components only
- Hooks over class methods
- `useState` for local state, `useReducer` for complex state, server state via React Query / SWR
- Component file structure: imports → types → component → exports
- Default export for components, named exports for utilities
- No `useEffect` for derived state — compute it

## API routes (Next.js)

- One handler per route
- Validate input with zod
- Return typed responses
- Always wrap in try/catch with specific error codes
- Never expose stack traces in production

## Database (Supabase)

- Always use migrations, never click-edits in dashboard
- Every table has `id`, `created_at`, `updated_at`
- Use `uuid` for IDs unless joining to external system that uses int
- Always enable RLS on user-data tables
- Currency stored as integers in smallest unit (cents, kip), never floats
- Timestamps in UTC, convert at display time

## Currency handling (critical)

- LAK and USD must never be mixed without explicit conversion
- FX rate stored at booking time on the booking record
- Display logic always uses stored FX rate, not current rate, for historical bookings
- Use `Intl.NumberFormat` for display

## Date handling

- Store all dates as UTC ISO 8601
- Hotel timezone: Asia/Vientiane for Namkhan
- Use date-fns or Temporal API, not Moment
- Never parse dates with `new Date(string)` — use explicit parsers

## Testing

- Required for: any calculation, currency conversion, date logic, booking logic, auth flows
- Optional for: pure UI presentation
- Use Vitest for unit, Playwright for E2E
- Coverage target: 80% on critical paths
- E2E tests live in `/e2e/`, mirror site routes

## Comments

- Why, not what
- Don't comment out code — delete it (Git remembers)
- TODO must include date and ticket number: `// TODO(2026-05-05, #142): refactor`

## Commits

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Subject line ≤72 chars
- Body explains why, not what
- Reference ticket: `Closes #142`

## PRs

- Title matches conventional commit format
- Description includes: what changed, why, how to test, rollback plan
- Screenshots for UI changes
- Preview URL pasted by Vercel bot
- All checks must pass before request review
- Squash merge to main

## Linting / formatting

- ESLint + Prettier configured at repo root
- No commits if `npm run lint` fails
- Pre-commit hook recommended (Husky)

## Security

- Never log PII or secrets
- Never trust user input — validate, sanitize
- Use parameterized queries always (Supabase client does this)
- Rate-limit public APIs
- CSP headers configured at Vercel level

## Performance

- Lighthouse Performance ≥90 on all public pages
- LCP <2.5s on mobile
- Bundle size budget: 250KB initial JS
- Images via `next/image` with proper sizes
- No render-blocking scripts

## Accessibility

- Semantic HTML first
- ARIA only when semantic isn't enough
- Keyboard navigable
- Color contrast WCAG AA minimum
- Lighthouse Accessibility ≥90
