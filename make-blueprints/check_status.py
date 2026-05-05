#!/usr/bin/env python3
import json, urllib.request

TOKEN = 'b1529778-7ddb-453f-bff5-0d1ea89f0fb3'

req = urllib.request.Request(
    'https://eu1.make.com/api/v2/scenarios/5573244/logs?pg[limit]=8',
    headers={'Authorization': f'Token {TOKEN}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=15) as r:
    d = json.load(r)

print('Recent 8 events:')
for e in d.get('scenarioLogs', []):
    et = e.get('eventType', e.get('type', '?'))
    ts = e.get('timestamp', '?')
    err = e.get('error', {})
    ops = e.get('operations', '-')
    cents = e.get('centicredits', '-')
    msg = err.get('message', '') if isinstance(err, dict) else ''
    print(f'  {ts}  {et:<25}  ops={ops}  cents={cents}  err={msg[:80]}')

req = urllib.request.Request(
    'https://eu1.make.com/api/v2/scenarios/5573244/blueprint',
    headers={'Authorization': f'Token {TOKEN}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=15) as r:
    bp = json.load(r)['response']['blueprint']
http = next(m for m in bp['flow'] if m['id'] == 2)
print()
print('Current body in scenario:')
body = http['mapper'].get('jsonStringBodyContent', '') or http['mapper'].get('data', '')
print(body[:600])
