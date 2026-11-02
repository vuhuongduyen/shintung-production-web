import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':resolve(root)}},server:{middlewareMode:true}});after(()=>vite.close());
const {default:Details}=await vite.ssrLoadModule('/components/headcount-details.tsx');
const employee={id:'B1',name:'Nhân viên tên rất dài',line:'B'};
const w=(start,end,extra={})=>({start,end,part:'hc',count:1,people:['B1'],provisional:[],actualAbsent:[],...extra});
const projection={label:'1',windows:[w(480,600),w(610,720),w(780,900),w(910,1020)],warnings:[]};
const render=extra=>renderToStaticMarkup(React.createElement(Details,{projection,date:'2026-10-19',line:'B',employees:[employee],events:[],...extra}));
test('identical break-separated membership renders one group, never implies work through breaks, roster only once',()=>{
 const html=render();assert.equal((html.match(/Nhân viên tên rất dài/g)||[]).length,1);assert.equal((html.match(/HC 08:00/g)||[]).length,1);
 assert.match(html,/08:00–10:00, 10:10–12:00, 13:00–15:00, 15:10–17:00/);assert.doesNotMatch(html,/08:00–17:00/);
 assert.match(html,/<details><summary>Chi tiết<\/summary>/);assert.match(html,/<details><summary>Danh sách nhân viên \(1\)<\/summary>/);assert.doesNotMatch(html,/<details[^>]*open|<table/);
 assert.match(html,/HR cập nhật đến 10\/11/);
});
test('unknown count stays explicit; explanations closed; deadline wraps year',()=>{
 const html=render({date:'2026-12-19',projection:{...projection,windows:[w(480,600,{count:null})],warnings:['Chưa đủ dữ liệu HR được phép xem.']}});assert.match(html.split('<details>')[0],/Chưa đủ dữ liệu/);assert.doesNotMatch(html.split('<details>')[0],/Không có biến động/);assert.match(html,/HR cập nhật đến 10\/01/);assert.doesNotMatch(html,/<details[^>]*open/);
});
test('absence names and transfer direction appear once in main summary; exact count changes retained',()=>{
 const html=render({projection:{...projection,windows:[w(480,600,{count:0,people:[],provisional:['B1']}),w(610,720)]},events:[{id:'M',kind:'line-movement',line:'C',destinationLine:'B',employees:['B1'],effectiveAt:'2026-10-19T08:00:00+07:00',endsAt:'2026-10-19T17:00:00+07:00'}]});
 const main=html.split('<details>')[0];assert.match(main,/Capacity · nghỉ HC · 08:00–10:00: Nhân viên tên rất dài/);assert.match(main,/C → B: Nhân viên tên rất dài/);assert.match(main,/08:00 HC: 0 người · 10:10 HC: 1 người/);
});
test('pending and out-of-window records keep their concise absence list without changing model',()=>{
 const before=JSON.stringify(projection),html=render({events:[{id:'P',kind:'line-absence',line:'B',employees:['B1'],approved:false,absenceType:'Nghỉ',effectiveAt:'2026-10-19T18:00:00+07:00',endsAt:'2026-10-19T19:00:00+07:00'}]});assert.match(html.split('<details>')[0],/Thực tế · Nghỉ \(chờ duyệt\)/);assert.equal(JSON.stringify(projection),before);
});
test('popover has bounded width and wraps long names rather than wide tables',()=>{
 const css=readFileSync(new URL('../app/planning-compact.css',import.meta.url),'utf8');assert.match(css,/max-width:min\(360px,calc\(100vw - 24px\)\)/);assert.match(css,/overflow-x:hidden/);assert.match(css,/\.headcount-compact li\{[^}]*overflow-wrap:anywhere/);
 const source=readFileSync(new URL('../components/actual-work-schedule.tsx',import.meta.url),'utf8');assert.match(source,/<HeadcountDetails/);assert.doesNotMatch(source,/const dayAbsences=|Danh sách theo dữ liệu được xem:/);
});

test('accepted HR event retains exact time, type and open-arrival status in default list',()=>{
 const html=render({projection:{...projection,windows:[w(480,600,{count:0,people:[],actualAbsent:['B1']})]},events:[{id:'H',kind:'line-absence',absenceType:'Đi trễ',line:'B',employees:['B1'],effectiveAt:'2026-10-19T08:00:00+07:00',endsAt:'2026-10-19T10:00:00+07:00',openArrival:true}]});assert.match(html,/Đi trễ/);assert.match(html,/08:00–Chưa đến/);assert.match(html.split('<details>')[0],/Thực tế · Đi trễ/);
});

test('overtime forecast uses the familiar TC label',()=>{
 const html=render({projection:{...projection,windows:[w(1050,1260,{part:'ot',count:0,people:[],provisional:['B1']})]}});assert.match(html.split('<details>')[0],/Capacity · nghỉ TC:/);assert.doesNotMatch(html,/nghỉ OT/);
});

const directoryMove={id:'PERM',kind:'line-movement',line:'A',destinationLine:'B',employees:['B1'],effectiveAt:'2026-10-01T08:00:00+07:00',endsAt:null,directoryAssignment:true};
test('verified permanent directory assignment is not a daily movement; roster and inputs remain intact',()=>{
 const events=[directoryMove],before=JSON.stringify({events,projection,employee});
 const html=render({events}),main=html.split('<details>')[0];
 assert.doesNotMatch(main,/A → B/);assert.match(main,/Không có biến động/);
 assert.match(html,/Danh sách nhân viên \(1\)/);assert.match(html,/Nhân viên tên rất dài \(B1\)/);
 assert.equal(JSON.stringify({events,projection,employee}),before);
});
test('unmarked open-ended, finite and order movements remain visible even when destination matches master',()=>{
 for(const event of [{...directoryMove,directoryAssignment:false},{...directoryMove,directoryAssignment:undefined},{...directoryMove,endsAt:'2026-10-20T17:00:00+07:00'},{...directoryMove,kind:'transfer'}]){
  assert.match(render({events:[event]}).split('<details>')[0],/A → B/);
 }
});
test('missing or mismatched master data cannot classify an assignment as the normal Line',()=>{
 for(const employees of [[],[{...employee,line:'C'}],[{id:'B1',name:employee.name}]])assert.match(render({events:[directoryMove],employees}).split('<details>')[0],/A → B/);
});
test('mixed movement retains unverified people and independent temporary borrowing',()=>{
 const html=render({employees:[employee,{id:'C1',name:'Other',line:'C'}],events:[{...directoryMove,employees:['B1','C1']},{...directoryMove,id:'TEMP',line:'C',directoryAssignment:false,endsAt:'2026-10-19T17:00:00+07:00'}]}).split('<details>')[0];
 assert.match(html,/A → B: Other/);assert.doesNotMatch(html,/A → B: Nhân viên/);assert.match(html,/C → B: Nhân viên/);
});
test('permanent assignment does not suppress HR absence or another employee movement',()=>{
 const html=render({employees:[employee,{id:'C1',name:'Other',line:'C'}],events:[directoryMove,{id:'ABS',kind:'line-absence',line:'B',employees:['B1'],absenceType:'Nghỉ',effectiveAt:'2026-10-19T08:00:00+07:00',endsAt:'2026-10-19T10:00:00+07:00'},{...directoryMove,id:'OTHER',employees:['C1'],directoryAssignment:false}]}).split('<details>')[0];
 assert.match(html,/Thực tế · Nghỉ: Nhân viên tên rất dài/);assert.match(html,/A → B: Other/);
});
test('future assignment is not shown before its effective interval, and normalized master Line is recognized',()=>{
 assert.doesNotMatch(render({events:[{...directoryMove,effectiveAt:'2026-10-20T08:00:00+07:00',directoryAssignment:false}]}).split('<details>')[0],/A → B/);
 assert.doesNotMatch(render({events:[directoryMove],employees:[{...employee,id:' b1 ',line:' b '}]}).split('<details>')[0],/A → B/);
});
