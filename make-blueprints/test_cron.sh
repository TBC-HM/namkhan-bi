#!/bin/bash
echo "=== with force_email filter ==="
curl -sS --max-time 60 "https://namkhan-bi.vercel.app/api/cron/poll-gmail?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS&force_email=pb@thenamkhan.com&since=2026-01-01" > /tmp/cron_out.json
cat /tmp/cron_out.json | head -c 2000
echo ""
