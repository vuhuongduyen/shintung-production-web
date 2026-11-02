import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuditDetails,auditDisplayValue,auditPathLabel,auditFieldLabel} from '../lib/website-test-log-display.mjs';
import {readWebsiteTestLog,visibleTestLogEntries} from '../lib/website-test-log.mjs';
import {annotateTestLogWarnings} from '../lib/website-test-log-warnings.mjs';
const details=(before,after,extra={})=>buildAuditDetails({before,after,hasBefore:true,hasAfter:true,...extra});
const changed=result=>result.rows.filter(row=>row.changed);
const rendered=result=>result.rows.map(row=>[auditPathLabel(row.path),auditDisplayValue(row.before),auditDisplayValue(row.after)]);
test('employee update gives field-level changes and preserves unchanged fields separately',()=>{
 const result=details({id:'E1',name:'An',line:'A',active:true},{id:'E1',name:'Anh',line:'B',active:false});
 assert.deepEqual(changed(result).map(r=>auditPathLabel(r.path)),['Tên','Chuyền','Đang hoạt động']);
 assert.deepEqual(rendered(result).at(-1),['Đang hoạt động','Có','Không']);
});
test('plan quantity, SKU labor hours and capacity nested inputs have meaningful labels',()=>{
 assert.deepEqual(rendered(details({plan:10},{plan:20})),[['Số lượng kế hoạch','10','20']]);
 assert.deepEqual(rendered(details({laborHour:0},{laborHour:1.5})),[['Giờ công / sản phẩm','0','1.5']]);
 assert.deepEqual(rendered(details({input:{workers:2}},{input:{workers:3}})),[['Thông số đầu vào › Số nhân viên','2','3']]);
});
test('unknown snapshot, null, zero, blank, false and missing field stay distinct',()=>{
 assert.match(rendered(details(null,{qty:0},{hasBefore:false}))[0][1],/Không rõ/);
 assert.match(rendered(details(null,{qty:0}))[0][1],/Không có bản ghi/);
 const result=rendered(details({qty:null,note:'',active:false},{qty:0,active:false}));
 assert.deepEqual(result[0],['Số lượng','Chưa có giá trị (null)','0']);
 assert.equal(result[1][1],'Để trống');assert.match(result[1][2],/Không có trường/);
});
test('additions and deletions expose saved fields without inventing prior values',()=>{
 assert.deepEqual(rendered(details(null,{name:'New'})),[['Tên','Không có bản ghi','New']]);
 assert.deepEqual(rendered(details({name:'Old'},null)),[['Tên','Old','Không có bản ghi']]);
 assert.deepEqual(rendered(details({name:'Old'},{name:'Old',_deleted:true})).at(-1),['Đã xóa','Không có trường này trong bản lưu','Có']);
});
test('nested arrays are positional and unknown field labels are retained verbatim',()=>{
 const result=details({rows:[{customField:{value:1}}]},{rows:[{customField:{value:2}},{qty:3}]});
 assert.equal(auditPathLabel(result.rows[0].path),'Danh sách dòng › Mục 1 (vị trí) › customField › value');
 assert.match(auditDisplayValue(result.rows[1].before),/Không có trường/);
 assert.equal(auditDisplayValue(result.rows[1].after),'3');
});
test('container type changes retain both scalar and nested values',()=>{
 const result=rendered(details({x:3},{x:{qty:4}}));assert.ok(result.some(row=>row[1]==='3'));assert.ok(result.some(row=>row[2]==='4'));
 const nullResult=rendered(details({x:null},{x:{qty:4}}));assert.ok(nullResult.some(row=>row[1]==='Chưa có giá trị (null)'));
});
test('secret fields are recursively omitted and input snapshots remain immutable',()=>{
 const before={name:'A',password:'secret',rows:[{token:'secret',qty:1}]},after={name:'B',rows:[{token:'secret',qty:2}]};const original=JSON.stringify(before);
 const result=details(before,after);assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(JSON.stringify(before),original);
});
test('timestamp values use GMT+7 without changing stored timestamps',()=>{
 const timestamp='2026-10-15T18:00:00.000Z';const result=details({updatedAt:timestamp},{updatedAt:timestamp});assert.equal(rendered(result)[0][1],'16/10/2026 01:00:00 (GMT+7)');assert.equal(result.rows[0].before.value,timestamp);
});
test('large structures have an explicit bounded display',()=>{
 const result=details({rows:Array.from({length:200},()=>({a:1,b:2,c:3}))},{rows:[]});assert.equal(result.rows.length,500);assert.equal(result.truncated,true);
});
test('hidden login aliases are excluded only after cross-user warnings are computed',()=>{
 const entries=[{id:'a',entity:'sku',record:'S1',actorId:'visible',action:'update',at:'2026-10-16T00:00:00Z'},{id:'b',entity:'sku',record:'S1',actorId:'hidden-id',action:'update',at:'2026-10-16T00:01:00Z'}];
 const annotated=annotateTestLogWarnings(entries);const result=visibleTestLogEntries(annotated,[{id:'hidden-id',login:'VTHDUYEN'}]);assert.equal(result.entries.length,1);assert.equal(result.entries[0].id,'a');assert.equal(result.reviewHints.length,1);assert.equal(result.reviewHints[0].evidence.actors.length,2);assert.equal(result.entries[0].warnings.length,0);assert.equal(annotated.length,2);
});
test('login matching is exact, case insensitive and never hides a similar display name',()=>{
 const entries=['vthduyen','VTHDUYEN','vthduyen2','other'].map(actorId=>({actorId,actor:'vthduyen',warnings:[]}));assert.deepEqual(visibleTestLogEntries(entries).entries.map(e=>e.actorId),['vthduyen2','other']);
});

test('hidden rows do not enter search, counts, actor options or pagination',async()=>{
 const at='2026-10-16T00:00:00Z';
 const rows=['vthduyen','visible'].map((actor,i)=>({entity:'admin_audit',record_key:String(i),payload:JSON.stringify({entity:'sku',key:actor,actor,at,before:{qty:1},after:{qty:2}})}));
 const db={prepare(sql){return {bind(){return this;},async all(){return {results:sql.includes("entity='users'")||sql.includes("entity='website_action_audit'")?[]:rows};}};}};
 const all=await readWebsiteTestLog(db);assert.equal(all.total,1);assert.deepEqual(all.actors.map(a=>a.id),['visible']);assert.equal(all.entries[0].record,'visible');
 const searched=await readWebsiteTestLog(db,new URLSearchParams({q:'vthduyen'}));assert.equal(searched.total,0);
});
test('warnings attached only to hidden events are retained as separate hints',()=>{
 const hidden={id:'h',actorId:'vthduyen',record:'S1',warnings:[{code:'large_labor_hour_change',evidence:{before:1,after:4}}]};
 const result=visibleTestLogEntries([hidden]);assert.equal(result.entries.length,0);assert.equal(result.reviewHints[0].code,'large_labor_hour_change');
});

test('display bounds disclose changed fields omitted by abbreviation',()=>{
 const before=Object.fromEntries(Array.from({length:151},(_,i)=>['k'+i,0])),after={...before,k150:1};
 const result=details(before,after);assert.equal(result.snapshotLimited,true);
 const array=details(Array(201).fill(0),[...Array(200).fill(0),1]);assert.equal(array.snapshotLimited,true);
 assert.equal(details({note:'a'.repeat(6001)},{note:'a'.repeat(6000)+'b'}).snapshotLimited,true);
});
test('ambiguous shared email is not guessed to belong to the hidden account',()=>{
 const accounts=[{id:'hidden-id',login:'vthduyen',email:'shared@test'},{id:'visible-id',login:'visible',email:'shared@test'}];
 const result=visibleTestLogEntries([{actorId:'shared@test',warnings:[]},{actorId:'visible-id',warnings:[]},{actorId:'hidden-id',warnings:[]}],accounts);
 assert.deepEqual(result.entries.map(e=>e.actorId),['shared@test','visible-id']);
});

test('unknown prototype-like keys remain unchanged',()=>{for(const key of ['constructor','toString','__proto__'])assert.equal(auditFieldLabel(key),key);});
test('execution receipts follow the excluded user display preference',()=>{
 const entry={source:'website_action_audit',actorId:'vthduyen',outcome:'denied',warnings:[]};assert.deepEqual(visibleTestLogEntries([entry]).entries,[]);
});
