#!/usr/bin/env python3
import json, urllib.request, urllib.error, time

TOKEN = 'b1529778-7ddb-453f-bff5-0d1ea89f0fb3'
SID = 5573244

try:
    req = urllib.request.Request(f'https://eu1.make.com/api/v2/scenarios/{SID}/start', data=b'{}',
        headers={'Authorization': f'Token {TOKEN}','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},
        method='POST')
    with urllib.request.urlopen(req, timeout=10) as r:
        print('start:', r.status)
except urllib.error.HTTPError as e:
    print('start (already running ok):', e.code)

req = urllib.request.Request(f'https://eu1.make.com/api/v2/scenarios/{SID}/run', data=b'{}',
    headers={'Authorization': f'Token {TOKEN}','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},
    method='POST')
with urllib.request.urlopen(req, timeout=10) as r:
    d = json.load(r)
exec_id = d['executionId']
print('Started:', exec_id)

for i in range(6):
    time.sleep(10)
    req2 = urllib.request.Request(f'https://eu1.make.com/api/v2/scenarios/{SID}/executions/{exec_id}',
        headers={'Authorization': f'Token {TOKEN}','User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req2, timeout=10) as r:
        d2 = json.load(r)
    st = d2.get('status','?')
    print(f'[{(i+1)*10}s] {st}')
    if st in ('SUCCESS','ERROR','FAILURE'):
        print(json.dumps(d2, indent=2)[:1200])
        break
