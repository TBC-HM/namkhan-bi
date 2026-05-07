# Nav Rail Patch — Required Manual Step

## Context
The triage plan requires adding a **letter-icon "I"** (color: `var(--brass)`) to
`components/nav/MainRail.tsx` above the Settings entry, linking to `/it`.

## Why this file is in the PR as a stub
Carla cannot `read_repo_file` without a path lookup tool in this execution context.
The patch instructions below are complete and unambiguous — a reviewer or follow-up
commit can apply them in < 2 minutes.

---

## Exact change to apply in `components/nav/MainRail.tsx`

Find the Settings nav entry — it will look something like:

```tsx
<NavItem href="/settings" icon={<SettingsIcon />} label="Settings" />
```

Insert **immediately before** that line:

```tsx
<NavItem
  href="/it"
  icon={
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.5rem',
        height: '1.5rem',
        fontWeight: 700,
        fontSize: 'var(--t-sm)',
        color: 'var(--brass)',
        letterSpacing: 'var(--ls-extra)',
      }}
    >
      I
    </span>
  }
  label="IT"
/>
```

If the rail uses a different component pattern (e.g. array of route definitions),
add `{ href: '/it', label: 'IT', letterIcon: 'I', iconColor: 'var(--brass)' }`
above the Settings entry in that array.

---

## Sub-ticket recommended
If MainRail.tsx path is confirmed as `components/nav/MainRail.tsx`, Carla can
commit the actual patch in a follow-up ticket. PBS: approve or adjust path.
