#!/bin/bash
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi || exit 1
echo "==== deploy started $(date) ===="
echo "node: $(which node) - $(node --version)"
echo "npx:  $(which npx)"
/usr/local/bin/npx --yes vercel --prod --yes --force 2>&1
echo "==== deploy ended $(date) ===="
