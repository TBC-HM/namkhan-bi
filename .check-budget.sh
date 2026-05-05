#!/bin/bash
B=$(date +%s%N)
curl -s -o /tmp/pul_b2.html "https://namkhan-bi.vercel.app/revenue/pulse?bust=$B"
echo "size: $(wc -c < /tmp/pul_b2.html)"
echo "plan.drivers refs: $(grep -c 'plan.drivers' /tmp/pul_b2.html)"
echo "Budget . X% titles:"
grep -oE 'Budget · [0-9.]+%' /tmp/pul_b2.html | head -5
echo "occupancy chart block analysis:"
python3 << 'EOF'
import re
h = open('/tmp/pul_b2.html').read()
i = h.find('Occupancy by room type')
if i > 0:
    chunk = h[i:i+8000]
    print('  budget hits:', chunk.count('Budget'))
    print('  plan.drivers hits:', chunk.count('plan.drivers'))
    m = re.search(r'Budget[^<]{0,100}', chunk)
    if m: print('  sample:', m.group(0))
    else: print('  no Budget text found in occupancy block')
EOF
