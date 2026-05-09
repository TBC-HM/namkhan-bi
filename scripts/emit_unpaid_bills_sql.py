#!/usr/bin/env python3
"""Read scripts/unpaid_bills.json and emit batched INSERT SQL for messy.unpaid_bills.

Usage: python3 emit_unpaid_bills_sql.py [batch_size]
Writes to scripts/unpaid_bills_inserts.sql (single multi-statement file with N batches).
"""
import json, os, sys

BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 100
HERE = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(HERE, 'unpaid_bills.json')
out = os.path.join(HERE, 'unpaid_bills_inserts.sql')

with open(src) as f:
    d = json.load(f)

source_file = d['source_file']
source_hash = d['source_file_hash']
rows = d['rows']

def lit(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)):
        return repr(v)
    s = str(v).replace("'", "''")
    return "'" + s + "'"

cols = '(supplier, due_date, amount_lak, balance_lak, status_raw, class_raw, location_raw, source_file, source_file_hash)'

lines = []
for start in range(0, len(rows), BATCH):
    chunk = rows[start:start+BATCH]
    values = []
    for r in chunk:
        values.append('(' + ', '.join([
            lit(r['supplier']),
            f"DATE {lit(r['due_date'])}" if r['due_date'] else 'NULL',
            lit(r['amount_lak']),
            lit(r['balance_lak']),
            lit(r['status_raw']),
            lit(r['class_raw']),
            lit(r['location_raw']),
            lit(source_file),
            lit(source_hash),
        ]) + ')')
    sql = (
        f"INSERT INTO messy.unpaid_bills {cols} VALUES\n  "
        + ',\n  '.join(values)
        + "\nON CONFLICT DO NOTHING;"
    )
    lines.append(sql)

with open(out, 'w') as f:
    f.write('\n\n'.join(lines) + '\n')

print(f'wrote {out} with {len(rows)} rows in {len(lines)} batches')
