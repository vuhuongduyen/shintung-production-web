"""Read-only normalization of ERP XLS exports; never use ERP computed labor hours."""
import xlrd,json,collections,sys,hashlib
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2])
names=['ExcelOutputString(1).xls','ExcelOutputString (1)(1).xls','NGUOI_BAO_CONG(1).xls','ProductionListReport_vi_Excel20261020163234800(1).xls']
a,b,n,c=[xlrd.open_workbook(str(root/f)).sheet_by_index(0) for f in names]
people=collections.defaultdict(list);groups=collections.defaultdict(list);pauses=collections.defaultdict(list);events=[]
iso=lambda t:t.replace(' ','T')+'+07:00'
for i in range(4,c.nrows):
 r=c.row_values(i)
 if str(r[0]).startswith('D'):people[r[0].strip()].append({'id':r[23].strip(),'name':r[24].strip()})
for i in range(1,a.nrows):
 r=a.row_values(i);op={'Nhập trạm/Ủy thác gia công':'start','Xuất trạm/Gia công hoàn tất':'complete','đưa đi kiểm định':'complete'}.get(r[5])
 if r[8].strip() not in ['A','B'] or r[6]!='Không hủy bỏ' or not op:continue
 groups[(r[0].strip(),r[12].strip())].append((i+1,r))
 if '2026-09-01'<=r[7]<'2026-10-21':events.append({'lsxCode':r[0].strip(),'sku':r[1],'line':r[8].strip(),'stageCode':r[12].strip(),'stageName':r[14],'kind':op,'effectiveAt':iso(r[7]),'sourceActor':r[9],'document':r[26].strip(),'sourceRow':i+1})
for i in range(1,b.nrows):
 r=b.row_values(i)
 if r[7].strip() not in ['A','B']:continue
 pause={'from':iso(r[9]),'to':iso(r[10]),'sourceRow':i+1};pauses[(r[3].strip(),r[8].strip())].append(pause)
 for op,t in [('pause',r[9]),('resume',r[10])]:
  if '2026-09-01'<=t<'2026-10-21':events.append({'lsxCode':r[3].strip(),'sku':r[1],'line':r[7].strip(),'stageCode':r[8].strip(),'stageName':r[6],'kind':op,'effectiveAt':iso(t),'sourceActor':r[13],'sourceRow':i+1,'pause':pause})
reports=[]
for key,rs in groups.items():
 start=actual=None
 for row,r in sorted(rs,key=lambda x:x[1][7]):
  if r[5]=='Nhập trạm/Ủy thác gia công':start=actual=r[7];continue
  end=r[7];doc=r[26].strip()
  if end<'2026-09-01':start=end;continue
  if not start or not people.get(doc):raise ValueError((doc,key,'Missing start or personnel'))
  if end>='2026-10-21':continue
  reports.append({'document':doc,'lsxCode':key[0],'stageCode':key[1],'stageName':r[14],'sku':r[1],'line':r[8].strip(),'name':r[2],'spec':r[3],'startedAt':iso(start),'actualStartedAt':iso(actual),'completedAt':iso(end),'quantity':r[4],'employees':people[doc],'pauses':[p for p in pauses[key] if p['from']<iso(end) and p['to']>iso(start)],'sourceRow':row,'sourceActor':r[9]});start=end
payload={'erpStages':reports,'erpEvents':events,'confirmSourceReports':True,'preserveOverlaps':True,'fallbackCalendar':'HC_MON_SAT_0800_1700_NO_OT','from':'2026-09-01','to':'2026-10-20','references':[{'file':f,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest()} for f in names]}
out.write_text(json.dumps(payload,ensure_ascii=False));print(json.dumps({'reports':len(reports),'events':len(events),'orders':len(set(r['lsxCode'] for r in reports))}))
