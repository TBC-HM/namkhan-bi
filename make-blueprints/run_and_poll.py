#!/usr/bin/env python3
import json, urllib.request, urllib.error, time

TOKEN = 'b1529778-7ddb-453f-bff5-0d1ea89f0fb3'
SCENARIO_ID = 5573244

# Run
req = urllib.request.Request(
    f'https://eu1.make.com/api/v2/scenarios/{SCENARIO_ID}/run',
    data=b'{}',
    headers={'Authorization': f'Token {TOKEN}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
    method='POST'
)
with urllib.request.urlopen(req, timeout=10) as r:
    d = json.load(r)
exec_id = d['executionId']
print('Started:', exec_id)

# Poll every 5s up to ~25s
for i in range(5):
    time.sleep(5)
    req2 = urllib.request.Request(
        f'https://eu1.make.com/api/v2/scenarios/{SCENARIO_ID}/executions/{exec_id}',
        headers={'Authorization': f'Token {TOKEN}', 'User-Agent': 'Mozilla/5.0'}
    )
    try:
        with urllib.request.urlopen(req2, timeout=10) as r:
            d2 = json.load(r)
        st = d2.get('status', '?')
        ops = d2.get('operations', '-')
        print(f'  [{(i+1)*10}s] status={st} ops={ops}')
        if st in ('SUCCESS', 'ERROR', 'FAILURE', 'COMPLETED'):
            print('---')
            print(json.dumps(d2, indent=2)[:1500])
            break
    except urllib.error.HTTPError as e:
        print(f'  poll error {e.code}')
