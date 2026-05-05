#!/usr/bin/env python3
import re, sys
h = open('/tmp/ch_stly.html').read()
print('size:', len(h))
print('--- KPI tiles ---')
for label in ['Commissions', 'Direct mix', 'OTA mix', 'Wholesale mix', 'Avg lead', 'Channel cost']:
    m = re.search(rf'>{label}.{{0,400}}', h, re.DOTALL)
    if m:
        txt = re.sub(r'<[^>]+>', ' ', m.group(0))
        txt = re.sub(r'\s+', ' ', txt).strip()
        print(' ', label, '→', txt[:160])
print('--- arrows/STLY markers ---')
print('▲ count:', h.count('▲'))
print('▼ count:', h.count('▼'))
print('vs STLY count:', h.count('vs STLY'))
print('Same time last year count:', h.count('Same time last year'))
