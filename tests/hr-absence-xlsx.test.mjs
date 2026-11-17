import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {JSDOM} from 'jsdom';
import {zipSync,strToU8} from 'fflate';
const dom=new JSDOM();globalThis.DOMParser=dom.window.DOMParser;
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false}});
const {readAbsenceXlsx}=await vite.ssrLoadModule('/lib/hr-absence-xlsx.ts');
after(async()=>{await vite.close();dom.window.close();});
const headers=['Ngày xin phép','Mã nhân viên','Tên NV','Loại nghỉ phép','Tên nghỉ phép','Thời gian bắt đầu','Thời gian kết thúc','Thời gian xin phép'];
function file(rows,formula=false){
 const values=[headers,...rows];const sheet='<worksheet><sheetData>'+values.map((r,i)=>`<row r="${i+1}">`+r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr">${formula&&i===1&&j===0?'<f>NOW()</f>':''}<is><t>${v}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>';
 const bytes=zipSync({'xl/workbook.xml':strToU8('<workbook xmlns:r="r"><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>'),'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>'),'xl/worksheets/sheet1.xml':strToU8(sheet)});
 return new File([bytes],'TEST.xlsx');
}
test('Excel structure: exact headers, strings, serial date/time and source row, no inferred TRVS classification',async()=>{
 const r=await readAbsenceXlsx(file([['16/11/2026','TEST001','Minh Anh','TRVS','Đến trễ về sớm','08:00','09:00','01:00'],['46342','TEST002','Lan Anh','15P','Dưới 15 phút','0.3333333333333333','0.33402777777777776','0.0006944444444444445']]));
 assert.equal(r.rows.length,2);assert.equal(r.rows[0].row,2);assert.equal(r.rows[0].date,'2026-11-16');assert.equal(r.rows[0].kind,'');assert.equal(r.rows[1].start,'08:00');assert.equal(r.rows[1].end,'08:01');assert.equal(r.rows[1].duration,'00:01');assert.match(r.fileHash,/^[a-f0-9]{64}$/);
});
test('reject formulas, empty data and over-limit file without writes',async()=>{
 const row=['16/11/2026','TEST001','Minh Anh','PN','Phép năm','08:00','17:00','08:00'];
 await assert.rejects(()=>readAbsenceXlsx(file([row],true)),/công thức/);await assert.rejects(()=>readAbsenceXlsx(file([])),/100/);await assert.rejects(()=>readAbsenceXlsx(file(Array.from({length:101},()=>row))),/100/);
});
