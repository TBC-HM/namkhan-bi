#!/bin/bash
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi
echo "=== vercel env ls production ==="
/usr/local/bin/npx --yes vercel env ls production 2>&1
