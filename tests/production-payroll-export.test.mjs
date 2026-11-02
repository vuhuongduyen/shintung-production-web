import {verifyPayrollCapture,captureEmployeeRows} from './payroll-pdf-capture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {mkdirSync,writeFileSync} from 'node:fs';
import {payrollExportReport,payrollXlsx,payrollPdf,payrollPdfReport} from '../lib/production-payroll-export.mjs';
import {payrollPreview,allocateLineFunds} from '../lib/production-payroll.mjs';
const fixture=()=>{
 const a=210.7,b=189.2,allocation=allocateLineFunds(a,b,6000000);
 const overviews=['A','B'].map((line,index)=>{const people=Array.from({length:24},(_,i)=>({id:`NV-${line}-${i+1}`,name:i===23?'Nhân viên Giả Cuối':`Nhân viên Giả ${line} ${i+1}`,hc:'8',ot:'1',calendarHc:9,calendarOt:2,absentHc:1,absentOt:1,helper:i===0?1:0,include:true}));people.push({id:`OUT-${line}`,name:'Nhân viên không tham gia',hc:'',ot:'0',helper:0,include:false});const selected=people.filter(p=>p.include),earned=index?b:a,share=allocation.lines[index],result=payrollPreview(earned,selected,share.allocated);return {line,people,selected,earned,share,result,actual:result.actual,support:result.helper,production:result.production,quantity:earned*10,rows:[{order:{id:line,planId:'PLAN-'+line,lsxCode:'LSX-'+line,sku:'SKU-'+line,name:'Sản phẩm '+line,spec:'80 cm'},qty:earned*10,unit:.1,earned,source:'Menu Giờ công'}]};});
 return {month:'2026-10',baseFund:'6000000',overviews,example:true,sources:[{line:'A',file:'2026-08 Giờ công.pdf'}],at:new Date('2026-10-07T06:30:00Z')};
};
test('payroll workbook exports only monthly summary and both employee lines, with column formulas; totals conserve funds',()=>{
 const input=fixture(),report=payrollExportReport(input);assert.equal(report.sheets.length,3);assert.ok(report.totalFund>0);assert.match(report.timestamp,/13:30/);
 const archive=unzipSync(payrollXlsx(report));assert.ok(archive['[Content_Types].xml']);assert.equal(Object.keys(archive).filter(k=>/worksheets/.test(k)).length,3);
 for(let i=1;i<=3;i++){const xml=strFromU8(archive[`xl/worksheets/sheet${i}.xml`]);assert.match(xml,/sheetData/);assert.doesNotMatch(xml,/<f>/);}
 for(const [i,r]of input.overviews.entries()){const sheet=report.sheets[i+1],employees=sheet.rows.filter(row=>row.kind==='data'&&String(row.values[0]?.v).startsWith('NV-'));assert.equal(employees.length,24);const header=sheet.rows.find(row=>row.kind==='header');const moneyColumn=header.values.findIndex(cell=>/Quỹ được hưởng Line|Tiền sản lượng/.test(String(cell?.v??'')));assert.ok(moneyColumn>=0,'Missing money column header');const total=employees.reduce((sum,row)=>sum+Number(row.values[moneyColumn].v),0);assert.equal(total,r.result.fund);assert.equal(Number(sheet.rows.at(-1).values[moneyColumn].v),total);assert.match(strFromU8(archive[`xl/worksheets/sheet${i+2}.xml`]),/Nhân viên Giả Cuối/);}
 assert.deepEqual(report.sheets.map(s=>s.name),['Tổng hợp tháng','NV Line A','NV Line B']);
 const content=report.sheets.flatMap(s=>s.rows.flatMap(r=>r.values.map(c=>String(c.v)))).join('\n');assert.doesNotMatch(content,/Quỹ chưa được hưởng|Quy tắc tính|Giờ hoàn thành theo LSX/);assert.match(content,/Giờ hoàn thành Line ÷ Giờ SX Line × 100%/);assert.match(content,/Phần theo đóng góp \+ Tiền chia thêm nếu đủ điều kiện/);
 const translated=payrollExportReport({...fixture(),t:s=>'EN '+s});const translatedHeader=translated.sheets[2].rows.find(r=>r.kind==='header');const translatedMoneyColumn=translatedHeader.values.findIndex(c=>String(c?.v??'').includes('Tiền sản lượng'));assert.ok(translatedMoneyColumn>=0);assert.ok(String(translatedHeader.values[translatedMoneyColumn].v).includes('EN Phần theo đóng góp + Tiền chia thêm nếu đủ điều kiện; Line C hoàn quỹ; NV chưa đủ điều kiện không nhận'));
 const safe=fixture();safe.overviews[0].people[0].name='=SUM(A1:A9) <NV> &';const xml=strFromU8(unzipSync(payrollXlsx(payrollExportReport(safe)))['xl/worksheets/sheet2.xml']);assert.match(xml,/inlineStr/);assert.match(xml,/&lt;NV&gt; &amp;/);
 const invalid=fixture();invalid.overviews[1].result.issues=['Thiếu giờ Nhân sự'];assert.throws(()=>payrollExportReport(invalid),/Chưa đủ/);
 const dir='.local-data/tests/payroll-export';mkdirSync(dir,{recursive:true});writeFileSync(dir+'/report.xlsx',payrollXlsx(report));
});
test('download PDF reconstructs every employee cell on each page and rejects missing/clipped captures',async()=>{
 const {createCanvas,GlobalFonts}=await import('@napi-rs/canvas');GlobalFonts.registerFromPath('public/fonts/OnspaReport.ttf','OnspaReport');
 const saved=globalThis.document,pages=[];
 globalThis.document={createElement:()=>{
  const canvas=createCanvas(1,1),page={width:842,height:595,texts:[],rects:[]};pages.push(page);
  const get=canvas.getContext.bind(canvas);
  canvas.getContext=kind=>{const ctx=get(kind),fill=ctx.fillText.bind(ctx),stroke=ctx.strokeRect.bind(ctx);
   ctx.fillText=(text,x,y,...rest)=>{page.texts.push({text:String(text),x,y,width:ctx.measureText(String(text)).width,align:ctx.textAlign});return fill(text,x,y,...rest);};
   ctx.strokeRect=(x,y,w,h)=>{page.rects.push({x,y,w,h});return stroke(x,y,w,h);};
   return ctx;};return canvas;
 }};
 try{
  const legacy=payrollExportReport(fixture());legacy.sheets.forEach(s=>delete s.pdfColumns);const bytes=await payrollPdf(legacy);assert.match(new TextDecoder().decode(bytes.slice(0,8)),/%PDF-1/);
  const pdfText=new TextDecoder().decode(bytes);assert.match(pdfText,/MediaBox \[0 0 842 595\]/);assert.match(pdfText,/PickTrayByPDFSize true/);assert.match(pdfText,/PrintScaling \/None/);
  const drawn=pages.flatMap(p=>p.texts.map(t=>t.text)).join(' ');assert.doesNotMatch(drawn,/chưa chốt hoặc chi trả|Giờ hoàn thành Line|chia thêm nếu đủ điều kiện/);assert.ok(pages.length<15,'Compact column headers must avoid excessive pages');
  const expected=['A','B'].flatMap(line=>[...Array.from({length:24},(_,i)=>({id:`NV-${line}-${i+1}`,name:i===23?'Nhân viên Giả Cuối':`Nhân viên Giả ${line} ${i+1}`})),{id:`OUT-${line}`,name:'Nhân viên không tham gia'}]);
  verifyPayrollCapture(pages,expected);
  const rows=captureEmployeeRows(pages),target=rows.find(row=>row.id==='NV-B-24');
  assert.ok(target&&target.idFragments.length>0,'Expected reconstructed B24 ID fragments');
  assert.ok(target.nameFragments.length>0,'Expected B24 name fragments');
  // Capture clone is mapped by page and exact draw-operation index; assert mutation is real.
  const missing=structuredClone(pages),source=pages[target.pageIndex].texts;
  const indices=target.idFragments.map(fragment=>source.indexOf(fragment));
  assert.ok(indices.every(index=>index>=0),'B24 fragments must belong to capture');
  const before=missing[target.pageIndex].texts.length;
  missing[target.pageIndex].texts=missing[target.pageIndex].texts.filter((_,index)=>!indices.includes(index));
  assert.equal(before-missing[target.pageIndex].texts.length,indices.length,'Negative omission must remove actual draw operations');
  assert.notDeepEqual(missing,pages,'Omission must change capture');
  assert.throws(()=>verifyPayrollCapture(missing,expected),/Employee IDs missing|out of order/);
  const clipped=structuredClone(pages),clipIndex=indices[0];
  const originalX=clipped[target.pageIndex].texts[clipIndex].x;
  clipped[target.pageIndex].texts[clipIndex].x=clipped[target.pageIndex].width+20;
  assert.notEqual(clipped[target.pageIndex].texts[clipIndex].x,originalX,'Clipping must modify a real fragment');
  assert.throws(()=>verifyPayrollCapture(clipped,expected),/Clipped text page/);
  const leftClip=structuredClone(pages);const rightAligned=leftClip.flatMap(page=>page.texts.map(t=>({page,t}))).find(({t})=>t.align==='right'&&t.width>0);
  assert.ok(rightAligned,'Fixture must contain right-aligned text');rightAligned.t.width=2000;
  assert.throws(()=>verifyPayrollCapture(leftClip,expected),/Clipped text|Text clipped/);
  const dir='.local-data/tests/payroll-export';mkdirSync(dir,{recursive:true});writeFileSync(dir+'/report.pdf',bytes);
 }finally{globalThis.document=saved;}
});

test('print projection removes only marked columns and puts other work before warehouse',async()=>{
 const original=payrollExportReport(fixture()),before=JSON.stringify(original),pdf=payrollPdfReport(original);
 const expected=['Tên nhân viên','Giờ lịch HC','Giờ lịch TC','Vắng HC','Vắng TC','Giờ hiện diện','Giờ CV khác','Giờ phụ kho','Giờ SX','Giờ SX line khác','Giờ tính SL','Tỷ trọng (%)','Tiền sản lượng','Điều kiện nhận'];
 for(const [i,sheet] of pdf.sheets.entries())if(i){
  assert.deepEqual(sheet.rows.find(r=>r.kind==='header').values.map(c=>c.v),expected);
  const source=original.sheets[i],start=source.rows.findIndex(r=>r.kind==='header');
  source.rows.slice(start+1,-1).forEach((r,index)=>{const actual=sheet.rows[start+1+index];assert.equal(actual.values[0].v,r.values[1].v);assert.equal(actual.values[6].v,r.values[14].v);assert.equal(actual.values[7].v,r.values[8].v);assert.equal(actual.values[12].v,r.values[13].v);});
  assert.equal(sheet.rows.at(-1).values[12].v,source.rows.at(-1).values[13].v);
 }
 assert.equal(JSON.stringify(original),before);
 const {createCanvas,GlobalFonts}=await import('@napi-rs/canvas');GlobalFonts.registerFromPath('public/fonts/OnspaReport.ttf','OnspaReport');const saved=globalThis.document;
 globalThis.document={createElement:()=>createCanvas(1,1)};
 try{const bytes=await payrollPdf(original);assert.match(new TextDecoder().decode(bytes),/MediaBox \[0 0 842 595\]/);writeFileSync('.local-data/tests/payroll-export/print-columns.pdf',bytes);}finally{globalThis.document=saved;}
});
