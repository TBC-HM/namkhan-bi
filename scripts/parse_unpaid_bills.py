#!/usr/bin/env python3
"""Parse Unpaid Bills.xls -> emit JSON rows + SHA-256 of source file.

Usage: python3 parse_unpaid_bills.py /path/to/file.xls > out.json
"""
import sys, json, hashlib, datetime as dt
import xlrd

src = sys.argv[1] if len(sys.argv) > 1 else '/Users/paulbauer/Desktop/Unpaid Bills.xls'

with open(src, 'rb') as f:
    data = f.read()
sha = hashlib.sha256(data).hexdigest()

wb = xlrd.open_workbook(src)
s = wb.sheet_by_index(0)

header_row = None
for i in range(min(15, s.nrows)):
    row = [str(c).strip().lower() for c in s.row_values(i)]
    if 'supplier' in row:
        header_row = i
        break
if header_row is None:
    print('ERROR: header row not found', file=sys.stderr)
    sys.exit(1)

header = [str(c).strip() for c in s.row_values(header_row)]
def col_idx(name):
    for i, h in enumerate(header):
        if h.strip().lower() == name.lower():
            return i
    return None

idx = {
    'supplier':  col_idx('Supplier'),
    'due_date':  col_idx('Due Date'),
    'amount':    col_idx('amount') if col_idx('amount') is not None else col_idx('Amount'),
    'balance':   col_idx('balance') if col_idx('balance') is not None else col_idx('Balance'),
    'status':    col_idx('Status'),
    'class':     col_idx('Class'),
    'location':  col_idx('Location'),
}

def parse_date(v):
    if v is None or v == '':
        return None
    if isinstance(v, float):
        try:
            t = xlrd.xldate_as_tuple(v, wb.datemode)
            return dt.date(t[0], t[1], t[2]).isoformat()
        except Exception:
            return None
    s_ = str(v).strip()
    if not s_:
        return None
    for fmt in ('%d/%m/%Y', '%d/%m/%y', '%Y-%m-%d', '%m/%d/%Y'):
        try:
            return dt.datetime.strptime(s_, fmt).date().isoformat()
        except Exception:
            continue
    return None

def parse_num(v):
    if v is None or v == '':
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s_ = str(v).strip().replace(',', '').replace(' ', '')
    if not s_:
        return None
    try:
        return float(s_)
    except Exception:
        return None

rows = []
for i in range(header_row + 1, s.nrows):
    raw = s.row_values(i)
    def cell(key):
        j = idx.get(key)
        if j is None or j >= len(raw):
            return None
        return raw[j]
    supplier = cell('supplier')
    if supplier is None or str(supplier).strip() == '':
        continue
    rows.append({
        'supplier':      str(supplier).strip(),
        'due_date':      parse_date(cell('due_date')),
        'amount_lak':    parse_num(cell('amount')),
        'balance_lak':   parse_num(cell('balance')),
        'status_raw':    (str(cell('status')).strip() if cell('status') not in (None, '') else None),
        'class_raw':     (str(cell('class')).strip() if cell('class') not in (None, '') else None),
        'location_raw':  (str(cell('location')).strip() if cell('location') not in (None, '') else None),
    })

print(json.dumps({
    'source_file': src.split('/')[-1],
    'source_file_hash': sha,
    'count': len(rows),
    'rows': rows,
}, ensure_ascii=False))
