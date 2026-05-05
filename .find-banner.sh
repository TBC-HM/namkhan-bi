#!/bin/bash
B=$RANDOM
curl -s -H 'Cache-Control: no-cache' -o /tmp/pace_v2.html "https://namkhan-bi.vercel.app/revenue/pace?cmp=stly&t=$B"
echo "size: $(wc -c < /tmp/pace_v2.html)"
echo "search for 'wired' banner area:"
grep -oE '.{100}\b\xe2\x9c\x93 Wired.{200}' /tmp/pace_v2.html | head -1
echo "raw 'snapshot' count:"
grep -c snapshot /tmp/pace_v2.html
echo "raw '_proxy' count:"
grep -c '_proxy' /tmp/pace_v2.html
echo "ANY mention of 'STLY source' in any encoding:"
python3 -c "
h=open('/tmp/pace_v2.html').read()
import re
for m in re.finditer(r'STLY source[\W\w]{0,150}', h):
    print('-', m.group(0)[:200])
"
