#!/bin/bash
cd "$(dirname "$0")"
export PATH=/usr/local/bin:/usr/bin:/bin
rm -f /tmp/nk-deploy.log /tmp/nk-deploy.done
nohup bash -c "npx vercel --prod --yes > /tmp/nk-deploy.log 2>&1; echo \$? > /tmp/nk-deploy.done" >/dev/null 2>&1 &
echo "launched pid=$!"
