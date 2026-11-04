import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../scripts/warehouse-sheet/ONSPA_STOCK_FORMULAS.gs',import.meta.url),'utf8'),context);
const rewrite=f=>context.ONSPA_congThucTonVoHieu_(f);
test('observed finite NHAP SKU-to-proposed quantity SUMIF retains all old boundaries and excludes disabled statuses',()=>{
 const formula='=(SUMIF(NHAP!$C$2:$C$151;A4;NHAP!$E$2:$E$151))',result=rewrite(formula);assert.equal(result.supported,true);assert.equal(result.changed,1);assert.equal(result.formula,'=(SUMIFS(NHAP!$E$2:$E$151;NHAP!$C$2:$C$151;A4;NHAP!$M$2:$M$151;"<>ĐÃ HỦY THEO YÊU CẦU SX";NHAP!$V$2:$V$151;"<>KHO ĐỒNG Ý HỦY"))');assert.equal(rewrite(result.formula).changed,0);assert.equal(rewrite(result.formula).supported,true);
 const comma=rewrite("=SUMIF('NHAP'!C152:C246,$A4,'NHAP'!E152:E246)");assert.equal(comma.supported,true);assert.match(comma.formula,/M152:M246/);assert.match(comma.formula,/V152:V246/);assert.ok(comma.formula.includes(',$A4,'));
});
test('mixed, whole-column, mismatched and alternative formulas fail closed with original text untouched',()=>{
 for(const formula of ['=SUMIF(NHAP!C:C,A4,NHAP!E:E)','=SUMIF(NHAP!C2:C151,A4,NHAP!E2:E152)','=SUMIF(NHAP!C2:C151,A4,NHAP!N2:N151)','=SUMIF(NHAP!C2:C151,A4,NHAP!E2:E151)+INDIRECT("A1")','=SUMIFS(NHAP!E2:E151,NHAP!C2:C151,A4)']){const r=rewrite(formula);assert.equal(r.supported,false,formula);assert.equal(r.formula,formula);assert.equal(r.changed,0);}
 const p=context.ONSPA_keHoachCongThucVoHieu_([{sheet:'Synthetic',row:4,column:7,formula:'=SUMIF(NHAP!C2:C151,A4,NHAP!E2:E151)'},{sheet:'Synthetic',row:5,column:7,formula:'=INDIRECT("A1")'}]);assert.equal(p.ready,false);assert.equal(p.blocked.length,1);assert.equal(p.changes.length,1);
});
test('exclusion keeps original rows, quantities and every active contribution; cancellation status does not erase history',()=>{
 const rows=[{sku:'A',quantity:200,status:'KHO ĐÃ XÁC NHẬN',cancel:''},{sku:'A',quantity:300,status:'CHỜ KHO XÁC NHẬN',cancel:''},{sku:'B',quantity:900,status:'KHO ĐÃ XÁC NHẬN',cancel:''}],original=structuredClone(rows),stock=()=>rows.filter(r=>r.sku==='A'&&r.status!=='ĐÃ HỦY THEO YÊU CẦU SX'&&r.cancel!=='KHO ĐỒNG Ý HỦY').reduce((n,r)=>n+r.quantity,0);
 assert.equal(stock(),500);rows[0].status='ĐÃ HỦY THEO YÊU CẦU SX';rows[0].cancel='KHO ĐỒNG Ý HỦY';assert.equal(stock(),300);assert.equal(rows.length,original.length);assert.deepEqual(rows.map(r=>r.quantity),original.map(r=>r.quantity));assert.deepEqual(rows.slice(1),original.slice(1));
});
