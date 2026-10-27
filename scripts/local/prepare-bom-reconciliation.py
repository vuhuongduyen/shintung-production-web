import json,collections,hashlib
from decimal import Decimal as D
import argparse
parser=argparse.ArgumentParser();parser.add_argument('rows_json');parser.add_argument('source_pdf');parser.add_argument('output_json');args=parser.parse_args()
rows=json.load(open(args.rows_json));boms=json.load(open('app/bom-data.json'));known={b['sku']:b for b in boms}
def num(s):return D(s.replace(',','.').replace('%','')) if s else D(0)
def fmt(v):return format(v.quantize(D('0.0000000001')),'f').rstrip('0').rstrip('.') if v else '0'
def half(s):return D(10)**(-len(s.split(',')[1]) if ',' in s else 0)/2
nodes=[];stack={};roots={}
for index,r in enumerate(rows):
 c=r['cells'];l=int(c[1].lstrip('.'))
 if l==0:
  root=c[0];roots[root]=dict(name=c[4],spec=c[5],unit=c[6],page=r['page']);stack={0:dict(code=root,qty=D(1),raw='1',unit=c[6],index=index,children=[])};nodes.append(stack[0]);continue
 p=stack[l-1];node=dict(code=c[2],qty=num(c[7]),raw=c[7],index=index,children=[],root=root,page=r['page'],name=c[4],spec=c[5],unit=c[6],waste=c[8],outer=c[10],source=c[3]);p['children'].append(node);stack[l]=node;nodes.append(node);stack={k:v for k,v in stack.items() if k<=l}
edges=collections.defaultdict(list)
for parent in nodes:
 groups=collections.defaultdict(list)
 for child in parent['children']:groups[child['code']].append(child)
 for code,children in groups.items():
  q=sum(c['qty'] for c in children);p=parent['qty'];h=sum(half(c['raw']) if ',' in c['raw'] else D(0) for c in children);hp=half(parent['raw']) if ',' in parent['raw'] else D(0)
  # root is exactly one unit, not a rounded PDF denominator
  if parent['index'] in [i for i,r in enumerate(rows) if r['cells'][1]=='0']:hp=D(0)
  edges[(parent['code'],code)].append(dict(q=q/p if p else None,lower=(q-h)/(p+hp) if p+hp else D(0),upper=(q+h)/(p-hp) if p-hp>0 else D('Infinity'),children=children))
patches=[];blocked=[];outer=[];missing=[]
for (parent,code),occ in edges.items():
 children=[c for o in occ for c in o['children']];pages=sorted(set(c['page'] for c in children));values={k:sorted(set(c[k] for c in children)) for k in ['name','spec','unit','waste']}
 fields={k:vs[0] for k,vs in values.items() if len(vs)==1 and k!='waste'}
 excluded=any(c['outer'] for c in children)
 if excluded:outer.append(dict(parent=parent,code=code,pages=pages))
 else:
  qs=set(o['q'] for o in occ);quantity=None
  if len(qs)==1 and None not in qs:quantity=next(iter(qs))
  elif None not in qs:
   # Recover a three-decimal direct ratio only if every printed value is compatible with it.
   lo=max(o['lower'] for o in occ);hi=min(o['upper'] for o in occ)
   candidates=set(q.quantize(D('0.001')) for q in qs)
   valid=[c for c in candidates if c>0 and lo<=c<=hi]
   if len(valid)==1:quantity=valid[0]
  if quantity is not None and len(values['waste'])==1:
   fields.update(qty=fmt(quantity),waste=fmt(num(values['waste'][0]))+'%' if values['waste'][0] else '—')
  else:blocked.append(dict(parent=parent,code=code,pages=pages,quantities=sorted(set(fmt(q) for q in qs if q is not None)),waste=values['waste'],reason='Định mức hoặc hao hụt không thống nhất trong PDF'))
 if parent not in known:missing.append(dict(parent=parent,code=code,pages=pages,reason='Chưa có BOM riêng; không tự tạo BOM cho mã mua hàng'));continue
 patches.append(dict(sku=parent,code=code,fields=fields,pages=pages,excluded=excluded,source='Ủy thác' if children[0]['source']=='NVL uỷ thác' else 'Tự chế' if children[0]['source']=='Hàng tự chế' else 'Mua',bounds=[str(max(o['lower'] for o in occ)),str(min(o['upper'] for o in occ))]))
manifest=dict(id='BOM-PDF-20260930',source='BAO_CAO_GIA_THANH_2026 - BOM (2).pdf',sha256=hashlib.sha256(open(args.source_pdf,'rb').read()).hexdigest(),rows=len(rows),roots=roots,patches=patches,blocked=blocked,outer=outer,missing=missing)
json.dump(manifest,open(args.output_json,'w'),ensure_ascii=False,indent=2)
print('patches',len(patches),'blocked',len(blocked),'outer',len(outer),'missing',len(missing));print(json.dumps(blocked,ensure_ascii=False,indent=1)[:5500])
