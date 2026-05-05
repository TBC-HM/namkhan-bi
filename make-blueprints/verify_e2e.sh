#!/bin/bash
set -e
BASE='https://namkhan-bi.vercel.app'
B=$RANDOM

echo "=== /inbox ==="
curl -sS -o /tmp/v_inbox.html -w "HTTP %{http_code}  %{size_download}b\n" "$BASE/inbox?bust=$B"

echo "=== /inbox?box=pb@thenamkhan.com ==="
curl -sS -o /tmp/v_inbox_pb.html -w "HTTP %{http_code}  %{size_download}b\n" "$BASE/inbox?box=pb@thenamkhan.com&bust=$B"

echo "=== /sales/inquiries ==="
curl -sS -o /tmp/v_inq.html -w "HTTP %{http_code}  %{size_download}b\n" "$BASE/sales/inquiries?bust=$B"

echo "=== inquiry detail (first real UUID found) ==="
INQ_PATH=$(curl -sS "$BASE/sales/inquiries" | grep -oE '/sales/inquiries/[a-f0-9-]{36}' | head -1)
echo "Detail path: $INQ_PATH"
curl -sS -o /tmp/v_det.html -w "HTTP %{http_code}  %{size_download}b\n" "$BASE$INQ_PATH"

echo ""
echo "=== Inbox features rendered? ==="
grep -oE '(Threads · [0-9]+|/inbox\?box=|Received|Sent|smoke test|hardcoded)' /tmp/v_inbox.html | sort | uniq -c | head -10

echo ""
echo "=== Inquiry detail features ==="
grep -oE '(Email thread|Open in Composer|message body|Compose)' /tmp/v_det.html | sort | uniq -c

echo ""
echo "=== Mail icon in banner? ==="
grep -c 'href="/inbox"' /tmp/v_inq.html
