#!/bin/bash
cd "$(dirname "$0")"
echo "=== namkhan-bi: type-check ==="
npx tsc --noEmit || { echo "❌ typecheck failed — aborting"; read -p "Press enter to close"; exit 1; }
echo ""
echo "=== namkhan-bi: vercel --prod ==="
npx vercel --prod --yes
echo ""
echo "=== Done ==="
read -p "Press enter to close"
