#!/bin/bash
# Triggered by Claude session for HK+Maint deploy 2026-04-30.
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi
echo "==== deploy start $(date) ===="
git log --oneline -1
echo ""
npx --yes vercel --prod --yes --force
echo "==== deploy end $(date) ===="
