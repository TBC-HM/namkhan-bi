#!/bin/bash
echo "size: $(wc -c < /tmp/pace_now.html)"
echo "STLY source matches:"
grep -oE 'STLY source[^<]{0,50}' /tmp/pace_now.html | head -3
echo "snapshot keyword:"
grep -c 'snapshot' /tmp/pace_now.html
echo "actuals proxy:"
grep -c 'actuals proxy' /tmp/pace_now.html
echo "otb_snapshots:"
grep -c 'otb_snapshots' /tmp/pace_now.html
