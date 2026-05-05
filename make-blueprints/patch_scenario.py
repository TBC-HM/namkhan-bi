#!/usr/bin/env python3
"""Patch Make scenario 5573244 with a clean HTTP body template."""
import json
import urllib.request
import urllib.error

TOKEN = 'b1529778-7ddb-453f-bff5-0d1ea89f0fb3'
SCENARIO_ID = 5573244

# Fetch current blueprint
req = urllib.request.Request(
    f'https://eu1.make.com/api/v2/scenarios/{SCENARIO_ID}/blueprint',
    headers={'Authorization': f'Token {TOKEN}', 'User-Agent': 'Mozilla/5.0'},
)
with urllib.request.urlopen(req, timeout=15) as r:
    bp = json.load(r)['response']['blueprint']

# Build a clean body template — direction always 'inbound' here;
# Vercel will flip it to 'outbound' if from_email ends in @thenamkhan.com.
# Simple field substitutions only — NO nested if() or escaped quotes.
# Use a body where each placeholder is INSIDE a quoted JSON string.
# This is the same pattern as the Mews scenario's working body.
# Single quotes inside expressions to avoid clashing with JSON's double quotes.
body = (
    '{\r\n'
    '  "direction": "inbound",\r\n'
    '  "mailbox": "pb@thenamkhan.com",\r\n'
    '  "from": "{{1.from.address}}",\r\n'
    '  "subject": "{{1.subject}}",\r\n'
    '  "message_id": "{{1.messageId}}",\r\n'
    '  "thread_id": "{{1.threadId}}",\r\n'
    '  "ingest_source": "make.gmail"\r\n'
    '}'
)

# Try raw mode this time — bypass Make's JSON pre-validation entirely.
for m in bp['flow']:
    if m['id'] == 2:
        m['mapper'] = {
            'url': 'https://namkhan-bi.vercel.app/api/sales/email-ingest',
            'method': 'post',
            'contentType': 'application/json',
            'inputMethod': 'raw',
            'data': body,
            'shareCookies': False,
            'parseResponse': True,
            'allowRedirects': True,
            'stopOnHttpError': False,
            'requestCompressedContent': True,
            'headers': [
                {'name': 'X-Make-Token', 'value': 'nk-bi-make-2026-Z3kT9pXqR7vL2NwY8mHsB4'},
            ],
        }

# PATCH back
patch_body = json.dumps({
    'blueprint': json.dumps(bp),
    'name': bp.get('name'),
    'scheduling': json.dumps({'type': 'on-demand'}),
})

req = urllib.request.Request(
    f'https://eu1.make.com/api/v2/scenarios/{SCENARIO_ID}',
    data=patch_body.encode(),
    headers={
        'Authorization': f'Token {TOKEN}',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
    },
    method='PATCH',
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        print('PATCH OK:', r.status)
except urllib.error.HTTPError as e:
    print('PATCH FAIL:', e.code, e.read().decode()[:500])

# Verify
req = urllib.request.Request(
    f'https://eu1.make.com/api/v2/scenarios/{SCENARIO_ID}/blueprint',
    headers={'Authorization': f'Token {TOKEN}', 'User-Agent': 'Mozilla/5.0'},
)
with urllib.request.urlopen(req, timeout=15) as r:
    flow = json.load(r)['response']['blueprint']['flow']
http = next(m for m in flow if m['id'] == 2)
saved = http.get('mapper', {}).get('jsonStringBodyContent', '') or http.get('mapper', {}).get('data', '')
print(f'\nBody saved: {len(saved)} chars')
print(saved[:500])
