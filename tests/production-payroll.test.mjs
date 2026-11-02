import test from 'node:test';
import assert from 'node:assert/strict';
import {efficiencyFactor,monthlyEarnedOrders,monthlyHelperHours,payrollPreview,standardForOrder,allocateLineFunds} from '../lib/production-payroll.mjs';
test('exact coefficient boundaries match supplied table without rounding a score up',()=>{
 for(const [score,factor] of [[0,0],[84.999,0],[85,.85],[89.999,.85],[90,.9],[94.999,.9],[95,.95],[99.999,.95],[100,1],[150,1]])assert.equal(efficiencyFactor(score),factor);
 assert.equal(efficiencyFactor(null),null);assert.equal(efficiencyFactor(NaN),null);
});
test('earned standard hours follow confirmed quantities and production month across an order, exclude pending/cancelled',()=>{
 const orders=[{id:'a',lsxCode:'LSX-A',line:'A',sku:'TEST-SKU-001',laborHour:.1},{id:'b',line:'B',sku:'x',laborHour:1}];
 const report=(id,date,qty,extra={})=>({id,transitId:'a',kind:'completion',productionDate:date,approvedQuantity:qty,reviewStatus:'Đã xác nhận',...extra});
 const reports=[report('r1','2026-09-30',100),report('r2','2026-10-01',200),report('r3','2026-10-02',999,{reviewStatus:'Chờ kiểm tra'}),report('r4','2026-10-02',888,{cancelled:true})];
 assert.equal(monthlyEarnedOrders(orders,reports,'2026-09','A')[0].earned,10);
 assert.equal(monthlyEarnedOrders(orders,reports,'2026-10','A')[0].earned,20);
 assert.equal(standardForOrder({sku:'x'},new Map([['X',.2]])).unit,.2);
 assert.equal(standardForOrder({laborHour:0}).unit,0);assert.equal(standardForOrder({sku:'missing'}).unit,null);
});
test('warehouse help reduces efficiency denominator but does not reduce employee share',()=>{
 const people=[{id:'NV1',name:'Nhân viên Giả Một',hc:180,ot:0,helper:20},{id:'NV2',name:'Nhân viên Giả Hai',hc:180,ot:0,helper:0}];
 const r=payrollPreview(306,people,3000000);assert.deepEqual(r.issues,[]);assert.equal(r.production,340);assert.equal(r.score,90);assert.equal(r.factor,.9);assert.equal(r.fund,2700000);
 assert.equal(r.payments.get('NV1'),1350000);assert.equal(r.payments.get('NV2'),1350000);
});
test('missing/invalid HR, missing standards, zero production and fractional funds cannot produce payments',()=>{
 for(const [earned,people,fund] of [[10,[{name:'A',hc:'',ot:0,helper:0}],3000000],[null,[{name:'A',hc:180,ot:0,helper:0}],3000000],[10,[{name:'A',hc:180,ot:0,helper:181}],3000000],[10,[{name:'A',hc:0,ot:0,helper:0}],3000000],[10,[{name:'A',hc:180,ot:0,helper:0}],1.2]]){
  const r=payrollPreview(earned,people,fund);assert.ok(r.issues.length);assert.equal(r.fund,null);assert.equal(r.payments.size,0);
 }
});
test('rounded employee payments sum to exactly the available fund',()=>{
 const r=payrollPreview(3,[{id:'A',hc:1,ot:0,helper:0},{id:'B',hc:1,ot:0,helper:0},{id:'C',hc:1,ot:0,helper:0}],100);
 assert.deepEqual([...r.payments.values()],[34,33,33]);assert.equal([...r.payments.values()].reduce((a,b)=>a+b,0),r.fund);
});
test('QLSX helper hours union overlaps, clip shifts/lunch/breaks and exclude pending/superseded events',()=>{
 const schedules=[{line:'A',days:[{date:'2026-10-01',working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'}],ot:false}]}];
 const event=(id,start,end,extra={})=>({id,kind:'line-absence',absenceType:'Phụ kho',line:'A',employees:['NV1'],effectiveAt:`2026-10-01T${start}:00+07:00`,endsAt:`2026-10-01T${end}:00+07:00`,...extra});
 const result=monthlyHelperHours([event('1','09:00','14:00'),event('2','11:00','15:00'),event('old','08:00','09:00',{voided:true})],schedules,[],'2026-10','A');
 assert.equal(result.hours.get('NV1'),29/6);assert.deepEqual(result.issues,[]);
 assert.ok(monthlyHelperHours([event('pending','08:00','09:00',{approved:false})],schedules,[],'2026-10','A').issues.length);
 assert.ok(monthlyHelperHours([event('1','08:00','09:00')],[],[],'2026-10','A').issues.length);
 const approved=[event('old','08:00','10:00'),event('new','08:00','09:00',{supersedes:'old'})];assert.equal(monthlyHelperHours(approved,schedules,[],'2026-10','A').hours.get('NV1'),1);
});
test('preview screen renders the supplied bands and uses calendar and HR absence input; shared terms support all three languages',async()=>{
 const {createServer}=await import('vite'),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const {fileURLToPath}=await import('node:url');const {resolve}=await import('node:path');const server=await createServer({appType:'custom',configFile:false,root:process.cwd(),resolve:{alias:{'@':resolve(fileURLToPath(new URL('..',import.meta.url)))}},server:{middlewareMode:true}});
 try{const {default:Screen}=await server.ssrLoadModule('/components/production-payroll.tsx');const html=renderToStaticMarkup(React.createElement(Screen,{orders:[],reports:[],events:[],schedules:[],employees:[],open:()=>{}}));
  assert.match(html,/Từ 95% đến dưới 100%/);assert.match(html,/Xuất Excel/);assert.match(html,/Xuất PDF/);assert.match(html,/Bảng hệ số/);assert.match(html,/Chưa đủ dữ liệu tính quỹ/);assert.doesNotMatch(html,/Vắng HC − Vắng TC do HR ghi/,'closed dialog must not render HR explanation by default');assert.match(html,/Quỹ chung A/);assert.match(html,/6000000/);assert.match(html,/Quy tắc tính sản lượng/);assert.match(html,/Giờ và tiền từng NV/);
  assert.equal((html.match(/data-standard-toolbar=/g)||[]).length,1);assert.match(html,/Quy tắc tính/);assert.match(html,/Tra cứu/);assert.match(html,/Quỹ chung A/);assert.doesNotMatch(html,/Nhập PDF Nhân sự/);assert.doesNotMatch(html,/data-standard-toolbar="PayrollHr(?:Import|Columns|Save)"/);
  const {translateToolbar}=await server.ssrLoadModule('/components/standard-toolbar/translations.ts');
  assert.equal(translateToolbar('Quỹ chung A + B','en'),'Shared A + B fund');assert.equal(translateToolbar('Quỹ chung A + B','zh'),'A+B共用基金');
  assert.equal(translateToolbar('Hiệu suất và tiền sản lượng','vi'),'Hiệu suất và tiền sản lượng');assert.equal(translateToolbar('Hiệu suất và tiền sản lượng','en'),'Efficiency and output bonus');assert.equal(translateToolbar('Hiệu suất và tiền sản lượng','zh'),'效率與產量獎金');
 }finally{await server.close();}
});

test('shared 6m fund follows earned hours, conserves money, guards missing other-line standards',()=>{
 const split=allocateLineFunds(600,400);assert.equal(split.total,1000);assert.deepEqual(split.lines.map(r=>r.allocated),[3600000,2400000]);
 const a=payrollPreview(600,[{id:'NV1',hc:600,ot:0,helper:0}],split.lines[0].allocated);
 const b=payrollPreview(400,[{id:'NV2',hc:500,ot:0,helper:0}],split.lines[1].allocated);
 assert.equal(a.fund,3600000);assert.equal(b.fund,0);
 assert.deepEqual(allocateLineFunds(0,10).lines.map(r=>r.allocated),[0,6000000]);
 assert.ok(allocateLineFunds(null,10).issues.length);assert.ok(allocateLineFunds(0,0).issues.length);assert.ok(allocateLineFunds(10,10,'').issues.length);
 for(const amount of [1,2,100,6000000])assert.equal(allocateLineFunds(1,2,amount).lines.reduce((s,r)=>s+r.allocated,0),amount);
});
test('payroll uses live menu standard even when old order snapshot exists; missing menu value blocks',()=>{
 const order={id:'lsx',line:'A',sku:'TEST-SKU-001',laborHour:99},r={kind:'completion',transitId:'lsx',productionDate:'2026-10-01',approvedQuantity:100,reviewStatus:'Đã xác nhận'};
 assert.equal(monthlyEarnedOrders([order],[r],'2026-10','A',new Map([['TEST-SKU-001',.2]]),true)[0].earned,20);
 assert.equal(monthlyEarnedOrders([order],[r],'2026-10','A',new Map(),true)[0].earned,null);
});
test('PDF preview matches identity, blocks mismatch/duplicate and needs valid reviewed hours',async()=>{
 const {matchHrRows,validHrRows}=await import('../lib/production-hr-import.mjs');
 const master=[{id:'TEST-NV-A01',name:'Lê Văn Đông',line:'A'},{id:'TEST-NV-B01',name:'Huỳnh Thị Diễm',line:'B'}];
 const rows=matchHrRows([{page:1,text:'1 TEST-NV-A01 Lê Văn Đông 180,5 12'},{page:1,text:'2 TEST-NV-B01 Huỳnh Thị Diễm 176 0'}],master).rows;
 assert.equal(rows[0].id,'TEST-NV-A01');assert.deepEqual(rows[0].numbers,['180,5','12']);assert.equal(validHrRows(rows),false);
 const populated=rows.map(r=>({...r,hc:r.numbers[0],ot:r.numbers[1]}));assert.equal(validHrRows(populated),true);
 assert.ok(matchHrRows([{text:'TEST-NV-A01 Huỳnh Thị Diễm 180 0'}],master).rows[0].issue);
 assert.ok(matchHrRows([{text:'TEST-NV-A01 Lê Văn Đông 180 0'},{text:'TEST-NV-A01 Lê Văn Đông 180 0'}],master).rows.every(r=>r.issue));
 assert.ok(matchHrRows([{text:'TEST-NV-A010 Lê Văn Đông 180 0'}],master).rows[0].issue);
 assert.equal(validHrRows(populated.map(r=>({...r,hc:744,ot:1}))),false);
});

test('reported order hours use lifetime LSX total across months and preserve missing hours',()=>{
 const orders=[{id:'a',line:'A',sku:'X',laborHour:.5}];
 const report=(id,qty,total,extra={})=>({id,transitId:'a',kind:'completion',reviewStatus:'Đã xác nhận',productionDate:'2026-10-02',approvedQuantity:qty,hours:{total},...extra});
 const reports=[report('final',10,2),report('stage',0,3),report('old',0,99,{replacedByStageBatch:'new'}),report('cancel',0,99,{cancelled:true}),report('pending',0,99,{reviewStatus:'Chờ kiểm tra'}),report('prior',0,13,{productionDate:'2026-09-30'})];
 const row=monthlyEarnedOrders(orders,reports,'2026-10','A')[0];assert.equal(row.earned,5);assert.equal(row.reported,18);
 reports[1].hours.total=7;assert.equal(monthlyEarnedOrders(orders,reports,'2026-10','A')[0].reported,22);
 reports[1].hours.total=null;assert.equal(monthlyEarnedOrders(orders,reports,'2026-10','A')[0].reported,null);
});
