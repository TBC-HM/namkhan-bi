#!/bin/bash
B=$RANDOM
echo "=== /inbox ==="
curl -sS -o /dev/null -w "HTTP %{http_code}  %{size_download}b\n" "https://namkhan-bi.vercel.app/inbox?bust=$B"
echo "=== /admin/gmail-connect ==="
curl -sS -o /dev/null -w "HTTP %{http_code}  %{size_download}b\n" "https://namkhan-bi.vercel.app/admin/gmail-connect?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS"
echo "=== /api/cron/poll-gmail (auth) ==="
curl -sS "https://namkhan-bi.vercel.app/api/cron/poll-gmail?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS" | head -c 200
echo ""
echo "=== /api/auth/gmail/start (should 307 to Google) ==="
curl -sS -o /dev/null -w "HTTP %{http_code}  Loc: %{redirect_url}\n" "https://namkhan-bi.vercel.app/api/auth/gmail/start?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS" 2>&1 | head -c 250
echo ""
echo "=== /sales/inquiries ==="
curl -sS -o /dev/null -w "HTTP %{http_code}  %{size_download}b\n" "https://namkhan-bi.vercel.app/sales/inquiries?bust=$B"
