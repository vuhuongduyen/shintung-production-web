"""Normalize incremental ERP exports; preserve source timestamps, never computed ERP hours."""
import xlrd,json,collections,sys,hashlib
from pathlib import Path
root,out=map(Path,sys.argv[1:3])
names=['ExcelOutputString (2).xls','ExcelOutputString (3).xls','ProductionListReport_vi_Excel20261023094846257.xls','DailyReport_Ontime_vi_Excel20261023094645693.xls']
a,b,c,d=[xlrd.open_workbook(str(root/f)).sheet_by_index(0) for f in names]
people=collections.defaultdict(dict);groups=collections.defaultdict(list);pauses=collections.defaultdict(list);events=[];ignored=[]
iso=lambda t:t.replace(' ','T')+'+07:00'
for i in range(4,c.nrows):
 r=c.row_values(i)
 if str(r[0]).startswith('D') and r[12] in ['A','B']:
  assert r[23] and r[24],('Missing employee',i+1)
  people[r[0].strip()][r[23].strip()]={'id':r[23].strip(),'name':r[24].strip()}
ops={'Nhập trạm/Ủy thác gia công':'start','Xuất trạm/Gia công hoàn tất':'complete','đưa đi kiểm định':'complete','Hủy nhập trạm':'cancel-start'}
for i in range(1,a.nrows):
 r=a.row_values(i);op=ops.get(r[5])
 if r[8].strip() not in ['A','B'] or r[6]!='Không hủy bỏ' or not op:continue
 assert '2026-10-20'<=r[7]<'2026-10-24',(i+1,'invalid date')
 groups[(r[0].strip(),r[12].strip())].append((i+1,r))
 events.append({'lsxCode':r[0].strip(),'sku':r[1],'line':r[8].strip(),'stageCode':r[12].strip(),'stageName':r[14],'kind':op,'effectiveAt':iso(r[7]),'sourceActor':r[9],'document':r[26].strip(),'sourceRow':i+1})
for i in range(1,b.nrows):
 r=b.row_values(i)
 if r[7].strip() not in ['A','B']:continue
 if not r[10]:
  events.append({'lsxCode':r[3].strip(),'sku':r[1],'line':r[7].strip(),'stageCode':r[8].strip(),'stageName':r[6],'kind':'pause','effectiveAt':iso(r[9]),'sourceActor':r[13],'sourceRow':i+1,'openPause':True});continue
 pause={'from':iso(r[9]),'to':iso(r[10]),'sourceRow':i+1};pauses[(r[3].strip(),r[8].strip())].append(pause)
 for op,t in [('pause',r[9]),('resume',r[10])]:events.append({'lsxCode':r[3].strip(),'sku':r[1],'line':r[7].strip(),'stageCode':r[8].strip(),'stageName':r[6],'kind':op,'effectiveAt':iso(t),'sourceActor':r[13],'sourceRow':i+1,'pause':pause})
reports=[]
for key,rs in groups.items():
 start=actual=None
 for row,r in sorted(rs,key=lambda x:(x[1][7],x[0])):
  if r[5]=='Nhập trạm/Ủy thác gia công':start=actual=r[7];continue
  if r[5]=='Hủy nhập trạm':start=actual=None;continue
  end=r[7];doc=r[26].strip();assert people.get(doc),(doc,key,'Missing personnel')
  reports.append({'document':doc,'lsxCode':key[0],'stageCode':key[1],'stageName':r[14],'sku':r[1],'line':r[8].strip(),'name':r[2],'spec':r[3],'startedAt':iso(start) if start else None,'actualStartedAt':iso(actual) if actual else None,'completedAt':iso(end),'quantity':r[4],'employees':list(people[doc].values()),'pauses':[p for p in pauses[key] if p['from']<iso(end) and (not start or p['to']>iso(start))],'sourceRow':row,'sourceActor':r[9]});start=end
# Independent quantity/stage/personnel validation against detailed report.
for r in reports:
 matches=[c.row_values(i) for i in range(4,c.nrows) if c.cell_value(i,0)==r['document']]
 assert all(x[5].split('/')[0]==r['lsxCode'] and x[7]==r['sku'] and x[16]==r['stageCode'] for x in matches),r['document']
 assert all(x[19]==r['quantity'] for x in matches) or sum(x[19] for x in matches)==r['quantity'],(r['document'],'quantity mismatch')
assert len(reports)==len(people)==len(set(r['document'] for r in reports))
payload={'erpStages':reports,'erpEvents':events,'updateMode':'merge-documents','confirmSourceReports':True,'preserveOverlaps':True,'fallbackCalendar':'HC_MON_SAT_0800_1700_NO_OT','from':'2026-10-20','to':'2026-10-23','references':[{'file':f,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest()} for f in names]}
out.write_text(json.dumps(payload,ensure_ascii=False));print(json.dumps({'reports':len(reports),'events':len(events),'orders':len(set(r['lsxCode'] for r in reports)),'missingStarts':[r['document'] for r in reports if not r['startedAt']],'finalQty':sum(r['quantity'] for r in reports if 'FINAL' in r['stageName'])}))
