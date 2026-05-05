#!/usr/bin/env python3
import json, urllib.request, urllib.error

TOKEN = 'b1529778-7ddb-453f-bff5-0d1ea89f0fb3'
SID = 5573244

req = urllib.request.Request(f'https://eu1.make.com/api/v2/scenarios/{SID}/start', data=b'{}',
    headers={'Authorization': f'Token {TOKEN}','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},
    method='POST')
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print('start:', r.status, r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print('start FAIL:', e.code, e.read().decode()[:500])
