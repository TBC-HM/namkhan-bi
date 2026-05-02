#!/bin/bash
# Wrapper that always exits 0 so osascript doesn't error on vercel non-zero exits.
# Output is captured at /tmp/vercel-deploy.log so we can tail it.
set +e
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi
{
  echo "=== START $(date '+%Y-%m-%dT%H:%M:%SZ') ==="
  echo "PATH=$PATH"
  which node && node --version
  which vercel && vercel --version
  which npx
  echo "--- linked project:"
  cat .vercel/project.json
  echo
  echo "--- running: npx --yes vercel --prod --yes"
  npx --yes vercel --prod --yes
  echo "=== EXIT $? at $(date '+%Y-%m-%dT%H:%M:%SZ') ==="
} > /tmp/vercel-deploy.log 2>&1
exit 0
