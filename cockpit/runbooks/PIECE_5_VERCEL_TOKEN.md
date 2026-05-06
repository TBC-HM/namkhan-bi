# Piece 5 — Replace VERCEL_TOKEN with permanent token

**Why**: I used your CLI session token (`vca_…` from `~/.local/share/com.vercel.cli/auth.json`) which expires ~5 months from now. When it expires, the deploy auto-rollback webhook will start failing silently. Replace once with a permanent token.

## Steps (3 min)

1. Open https://vercel.com/account/tokens
2. Click **Create Token**
3. Name: `namkhan-bi-cockpit`
4. Scope: **Full Access** (the rollback API needs `deployments:write`)
5. Expiration: **No Expiration** (or 1 year if you prefer rotation)
6. Copy the token (starts with `vct_…`)
7. In Terminal:

```bash
cd ~/Desktop/namkhan-bi
printf "vct_YOUR_TOKEN_HERE" | npx vercel env add VERCEL_TOKEN production --force
```

8. Re-deploy so the new token is picked up:

```bash
npx vercel --prod --yes
```

9. Verify by hitting the webhook GET endpoint:

```bash
curl 'https://namkhan-bi.vercel.app/api/cockpit/webhooks/vercel'
```

Should return JSON with the endpoint description (no error).

## When done

Tell Claude "Piece 5 done" and we move on.
