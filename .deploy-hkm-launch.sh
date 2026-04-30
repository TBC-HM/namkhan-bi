#!/bin/bash
# Detached launcher — fires the actual deploy in background, returns immediately.
chmod +x /Users/paulbauer/Desktop/namkhan-bi/.deploy-hkm-now.sh
nohup /Users/paulbauer/Desktop/namkhan-bi/.deploy-hkm-now.sh > /tmp/nb_hkm_deploy.log 2>&1 < /dev/null &
disown
echo "LAUNCHED pid=$!"
