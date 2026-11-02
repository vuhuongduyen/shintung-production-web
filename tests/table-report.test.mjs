import test from 'node:test';
import assert from 'node:assert/strict';
import {filterReportRows,reportDate,tableExportReport,laborUnitDeviation} from '../lib/table-report.mjs';
import {orderLaborOutput} from '../lib/production-output-summary.mjs';
import {payrollXlsx,payrollPdf} from '../lib/production-payroll-export.mjs';
import {unzipSync,strFromU8} from 'fflate';
import {mkdirSync,writeFileSync} from 'node:fs';
test('date range includes both boundary days in Vietnam and rejects reverse range',()=>{
 assert.equal(reportDate('2026-10-06T18:00:00Z'),'2026-10-07');
 assert.equal(reportDate('07/10/2026 23:59:59'),'2026-10-07');
 const rows=[['a','06/10/2026 23:59'],['b','07/10/2026 00:00'],['c','08/10/2026 23:59'],['d','09/10/2026'],['e','']];
 assert.deepEqual(filterReportRows(rows,{from:'2026-10-07',to:'2026-10-08',dateColumn:1}).map(r=>r[0]),['b','c']);
 assert.throws(()=>filterReportRows(rows,{from:'2026-10-09',to:'2026-10-07',dateColumn:1}),/trước/);
 assert.throws(()=>filterReportRows(rows,{from:'2026-10-07'}),/cột ngày/);
});
test('strict ±10% warning only for complete confirmed orders with positive standard',()=>{
 assert.equal(laborUnitDeviation(.11,.1).warning,false);assert.equal(laborUnitDeviation(.09,.1).warning,false);
 assert.equal(laborUnitDeviation(.111,.1).warning,true);assert.equal(laborUnitDeviation(.089,.1).warning,true);
 assert.deepEqual(laborUnitDeviation(null,.1),{ratio:null,warning:false});assert.equal(laborUnitDeviation(.1,0).ratio,null);
 const order={id:'a',lsxQty:300,actualCompletedAt:'2026-10-07T08:00:00Z'},reports=[{transitId:'a',kind:'completion',reviewStatus:'Đã xác nhận',approvedQuantity:100,hours:{hc:18,ot:0}},{transitId:'a',kind:'completion',reviewStatus:'Đã xác nhận',approvedQuantity:200,hours:{hc:36,ot:0}}];
 assert.equal(orderLaborOutput(order,reports).unit,.18);
 assert.equal(orderLaborOutput({...order,actualCompletedAt:null},reports).unit,null);
 assert.equal(orderLaborOutput(order,[reports[0],{...reports[1],reviewStatus:'Chờ kiểm tra',reportedQuantity:200}]).unit,null);
});
test('preview snapshot exports all 47 filtered rows as real XLSX and PDF',async()=>{
 const rows=Array.from({length:48},(_,i)=>['NV'+i,'Âu Hồng Sơn','07/10/2026 16:30:00',i+.5]);
 rows[47][2]='08/10/2026';
 const report=tableExportReport({title:'Nhật ký báo công',headers:['Mã NV','Tên nhân viên','Thời điểm hiệu lực','Giờ công'],rows,from:'2026-10-07',to:'2026-10-07',dateColumn:2});
 rows[0][1]='Changed live';assert.equal(report.sheets[0].rows[5].values[1].v,'Âu Hồng Sơn');
 const bytes=payrollXlsx(report),zip=unzipSync(bytes),xml=strFromU8(zip['xl/worksheets/sheet1.xml']);
 assert.match(xml,/NV46/);assert.doesNotMatch(xml,/NV47/);assert.match(xml,/<v>46.5<\/v>/);
 const {createCanvas,GlobalFonts}=await import('@napi-rs/canvas');GlobalFonts.registerFromPath('public/fonts/OnspaReport.ttf','OnspaReport');
 globalThis.document={createElement:()=>createCanvas(1,1)};
 const pdf=await payrollPdf(report);delete globalThis.document;
 assert.match(new TextDecoder().decode(pdf.slice(0,8)),/%PDF/);
 mkdirSync('.local-data/tests/table-report',{recursive:true});writeFileSync('.local-data/tests/table-report/report.xlsx',bytes);writeFileSync('.local-data/tests/table-report/report.pdf',pdf);
});
