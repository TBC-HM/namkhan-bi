#!/bin/bash
rm -f /tmp/nb_deploy.log
nohup /Users/paulbauer/Desktop/namkhan-bi/.deploy_now.sh > /tmp/nb_deploy.log 2>&1 &
echo $! > /tmp/nb_deploy.pid
