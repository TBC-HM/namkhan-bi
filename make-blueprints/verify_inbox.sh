#!/bin/bash
B=$RANDOM
HTTP=$(curl -sS -o /tmp/inbox_v2.html -w "HTTP %{http_code} · %{size_download}b" "https://namkhan-bi.vercel.app/inbox?bust=$B")
echo "$HTTP"
echo "--- KPI labels ---"
grep -oE '(MEDIAN REPLY|RECEIVED|SENT|IMPORTANT|STARRED|SPAM)' /tmp/inbox_v2.html 2>/dev/null | sort -u
echo "--- chart titles ---"
grep -oE '(Volume[^<]{0,30}|By <em>mailbox|Response[^<]{0,30}time)' /tmp/inbox_v2.html 2>/dev/null | sort -u | head -5
echo "--- recharts present ---"
grep -c "recharts-" /tmp/inbox_v2.html 2>/dev/null
echo "--- response time tags found ---"
grep -oE '↩ [0-9][^<]{0,12}' /tmp/inbox_v2.html 2>/dev/null | head -5
echo "--- mailbox short labels ---"
grep -oE '@nk\b' /tmp/inbox_v2.html 2>/dev/null | wc -l | tr -d ' '
