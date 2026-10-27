"""Explicit, read-only PDF extraction. Output belongs outside public and Git."""
import argparse, datetime, hashlib, json, pathlib, re
import pdfplumber

def integer(value):
    value = (value or '').strip()
    if not re.fullmatch(r'-?(?:\d+|\d{1,3}(?:[.,]\d{3})+)', value):
        raise ValueError(f'Ambiguous integer: {value!r}')
    return int(value.replace('.', '').replace(',', ''))

def next_month(value):
    month, year = map(int, value.split('/'))
    if not 1 <= month <= 12: raise ValueError(value)
    return f'{month % 12 + 1:02}/{year + (month == 12)}'

def extract_forecast(path, expected):
    rows, group = [], ''
    with pdfplumber.open(path) as pdf:
        text = pdf.pages[0].extract_text()
        source = re.search(r'Tháng báo cáo\s+(\d{2}/\d{4})', text).group(1)
        exported = re.search(r'Ngày xuất\s+(\d{2}/\d{2}/\d{4})', text).group(1)
        assert int(re.search(r'Tổng SKU\s+(\d+)', text).group(1)) == expected
        for page_number, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for cells in table:
                    first = cells[0] or ''
                    if first.startswith('NHÓM:'): group = first.split(':', 1)[1].strip()
                    if len(cells) != 8 or not re.fullmatch(r'[A-Za-z0-9-]+', first) or not re.search(r'\d', first): continue
                    sku, name, spec, line = [v or '' for v in cells[:4]]
                    adjustment, f30, f60, f90 = map(integer, cells[4:])
                    assert min(f30, f60, f90) >= 0
                    rows.append(dict(sku=sku, name=name, spec=spec, line=line, group=group,
                        adjustment30D=adjustment, f30=f30, f60=f60, f90=f90,
                        sourceReportMonth=source, applicationMonth=next_month(source), month=next_month(source),
                        reportExportDate=exported, sourcePage=page_number))
    assert len(rows) == len({r['sku'] for r in rows}) == expected
    return rows

def extract_demand(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for c in table:
                    if len(c) != 13 or not re.fullmatch(r'\d{2}/\d{2}/\d{4}', c[0] or ''): continue
                    c = [v or '' for v in c]
                    for index in [0, 5, 12]:
                        if c[index]: datetime.datetime.strptime(c[index], '%d/%m/%Y')
                    row = dict(zip(['requestDate','sku','name','qty','spec','delivery','group','priority','order','type','updatedBy','status','plannedWeek'], c))
                    row['qty'] = integer(c[3])
                    row['priority'] = re.sub(r'\[\d+\]', '', c[7]).strip()
                    row['sourcePage'] = page_number
                    assert row['status'].upper() == 'ĐÃ LẬP KẾ HOẠCH'
                    rows.append(row)
    keys = {tuple(r[k] for k in ['requestDate','sku','qty','delivery','type','plannedWeek']) for r in rows}
    assert len(rows) == len(keys) == 104
    return rows

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('july'); parser.add_argument('august'); parser.add_argument('demand'); parser.add_argument('output')
    args = parser.parse_args()
    paths = [pathlib.Path(getattr(args, k)) for k in ['july','august','demand']]
    result = dict(format='ONSPA-PDF-PLANNING-v1', forecasts=[extract_forecast(paths[0],302), extract_forecast(paths[1],304)],
        demand=extract_demand(paths[2]), sources=[dict(name=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in paths])
    out = pathlib.Path(args.output).resolve()
    root = pathlib.Path(__file__).resolve().parents[2]
    if not out.is_relative_to(root / '.local-data'): raise ValueError('Output must be in private .local-data')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(forecasts=[len(r) for r in result['forecasts']],demand=len(result['demand']))))
