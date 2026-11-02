import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTestLog,sanitizeTestLogValue,filterTestLog,readWebsiteTestLog} from '../lib/website-test-log.mjs';
const at='2026-10-15T18:00:00.000Z';
const row=(entity,key,payload)=>({entity,record_key:key,payload:JSON.stringify(payload),updated_at:at});
test('mutations classify add, update and soft delete; unknown historical actor stays unknown',()=>{
 const values=normalizeTestLog([row('admin_audit','a',{entity:'sku',key:'S1',before:null,after:{name:'New'},at}),row('admin_audit','b',{entity:'sku',key:'S2',before:{name:'A'},after:{name:'B'},actor:'u1',at}),row('admin_audit','c',{entity:'sku',key:'S3',before:{name:'A'},after:{name:'A',_deleted:true},actor:'u1',at})]);
 assert.deepEqual(values.map(v=>v.action),['add','update','delete']);assert.equal(values[0].actorId,'');assert.match(values[0].actor,/Không rõ/);
});
test('exclude logins, logout, views, previews, presence, explicit unchanged/replayed and metadata-only differences',()=>{
 const rows=['LOGIN','LOGOUT','view','search','preview','SETUP_ADMIN_DEVICE_ACTIVATED'].map(action=>row('admin_audit',action,{action,actor:'u1',at}));
 rows.push(row('admin_audit','presence',{entity:'active_viewer',before:null,after:{name:'A'}}),row('admin_audit','noop',{before:{name:'A',version:1},after:{name:'A',version:2}}),row('production_event','replay',{kind:'start',replayed:true}),row('production_event','unchanged',{kind:'start',unchanged:true}));
 assert.equal(normalizeTestLog(rows).length,0);
});
test('redacts credentials recursively, including hashes/base64, and omits nested history',()=>{
 const clean=sanitizeTestLogValue({password:'secret',password_hash:'hash',salt:'salt',authorization:'bearer',nested:{accessToken:'token',api_key:'key',name:'Allowed'},base64:'file',history:[{name:'old'}]});
 assert.deepEqual(clean,{nested:{name:'Allowed'}});
});
test('normalizes domain and embedded histories without inventing absent before snapshots',()=>{
 const values=normalizeTestLog([row('sku_history','s',{sku:'SKU1',before:null,data:{name:'A'},changedBy:'u',changedAt:at}),row('employees','E1',{history:[{by:'u',at,before:null,after:{name:'Worker'}}]}),row('capacity','2026-10-12',{rows:[{line:'A',history:[{actor:'u',at,action:'save',before:{workers:1},after:{workers:2}}]}]}),row('production_event','event',{kind:'start',actor:'u',recordedAt:at,sourceId:'LSX1'})]);
 assert.equal(values.length,4);const event=values.find(v=>v.source==='production_event');assert.equal(event.hasBefore,false);assert.equal(event.before,null);assert.equal(event.hasAfter,false);assert.equal(event.record,'LSX1');
});
test('field changes create only recorded field snapshots',()=>{
 const [entry]=normalizeTestLog([row('in_transit_audit','t',{recordId:'LSX1',changes:[{field:'qty',before:1,after:2}],actor:'u',at})]);
 assert.deepEqual(entry.before,{qty:1});assert.deepEqual(entry.after,{qty:2});
});
test('dedupes exact mirrored histories but retains distinct same-time writes',()=>{
 const p={entity:'sku',key:'S1',actor:'u',at,before:{name:'A'},after:{name:'B'}};
 const entries=normalizeTestLog([row('admin_audit','a',p),row('sku_history','s',{sku:'S1',changedBy:'u',changedAt:at,before:p.before,data:p.after}),row('admin_audit','b',{...p,key:'S2'})]);
 assert.equal(entries.length,2);
 const corrections=normalizeTestLog([row('admin_audit','correction',{entity:'production_event',key:'anchor',before:{qty:1},after:{qty:2},actor:'u',at}),row('production_event','correction',{kind:'report-correction',actor:'u',recordedAt:at})]);assert.equal(corrections.length,1);
});
test('resolves unique account alias and never guesses ambiguous or missing actors',()=>{
 const records=[row('production_event','a',{kind:'start',actor:'a@example.test',recordedAt:at}),row('production_event','b',{kind:'start',recordedAt:at})];
 const entries=normalizeTestLog(records,[{login:'USER1',name:'An',email:'a@example.test'}]);assert.equal(entries[0].actorId,'USER1');assert.equal(entries[1].actorId,'');
 const ambiguous=normalizeTestLog(records,[{login:'USER1',email:'a@example.test'},{login:'USER2',email:'a@example.test'}]);assert.equal(ambiguous[0].actorId,'a@example.test');
});
test('Vietnam calendar date boundaries and actor/menu/action filters',()=>{
 const entries=normalizeTestLog([row('admin_audit','a',{entity:'sku',key:'S1',actor:'u',at,before:null,after:{name:'A'}})]);
 assert.equal(filterTestLog(entries,new URLSearchParams({from:'2026-10-16',to:'2026-10-16',actor:'u',entity:'sku',action:'add',q:'S1'})).total,1);
 assert.equal(filterTestLog(entries,new URLSearchParams({to:'2026-10-15'})).total,0);
});
test('pagination has deterministic ids and bounded page size',()=>{
 const entries=normalizeTestLog(Array.from({length:120},(_,i)=>row('production_event',String(i),{kind:'start',actor:'u',recordedAt:at})));
 const page=filterTestLog(entries,new URLSearchParams({limit:'999',offset:'10'}));assert.equal(page.limit,100);assert.equal(page.entries.length,100);assert.equal(page.hasMore,true);assert.equal(new Set(entries.map(e=>e.id)).size,120);
});
test('malformed histories do not crash or leak unknown source data',()=>{
 assert.deepEqual(normalizeTestLog([{entity:'admin_audit',record_key:'bad',payload:'bad'},row('auth_accounts','secret',{password:'secret'})]),[]);
});
test('reader performs read-only allowlisted queries and returns explicit coverage warning',async()=>{
 const queries=[];const db={prepare(sql){queries.push(sql);return{bind(){return this;},async all(){return{results:sql.includes("entity='users'")||sql.includes("entity='website_action_audit'")?[]:[row('admin_audit','a',{entity:'sku',before:null,after:{name:'A'},actor:'u',at})]};}};}};
 const result=await readWebsiteTestLog(db);assert.equal(result.entries.length,1);assert.match(result.coverage,/chưa/);assert.equal(result.truncated,false);assert.equal(queries.every(q=>q.startsWith('SELECT ')||q.startsWith('WITH ')),true);assert.equal(queries.some(q=>q.includes('auth_accounts')),false);
});
test('capacity confirmation and review remain visible even when input snapshots did not change',()=>{
 const entries=normalizeTestLog([row('capacity','week',{rows:[{line:'A',history:[{action:'confirm',at,actor:'u',before:{workers:1},after:{workers:1}},{action:'save',at,actor:'u',before:{workers:1},after:{workers:1}}]}]})]);assert.equal(entries.length,1);assert.equal(entries[0].operation,'confirm');
});
test('dedupes legacy partial labor and leadtime mirrors using corroborating business values',()=>{
 const entries=normalizeTestLog([row('admin_audit','labor',{entity:'labor_hours',key:'SKU1',actor:'u',at,before:{sku:'SKU1',laborHour:1,note:''},after:{sku:'SKU1',laborHour:2,note:''}}),row('labor_hours_history','h',{sku:'SKU1',actor:'u',at,oldLaborHour:1,newLaborHour:2,oldNote:'',newNote:''}),row('admin_audit','lead',{entity:'leadtime_versions',key:'V1',actor:'u',at,before:null,after:{sku:'SKU2',version:1,leadTime:3}}),row('leadtime_audit','lh',{sku:'SKU2',version:1,newLeadTime:3,operator:'u',at,action:'Thêm mới'})]);assert.equal(entries.length,2);
});
test('large changed arrays are not mistaken for no-ops after display truncation; raw values never leave normalization',()=>{
 const before={rows:Array(201).fill(1),password:'secret',hash:'hidden'},after={rows:[...Array(200).fill(1),2],password:'secret',hash:'hidden'};
 const entries=normalizeTestLog([row('admin_audit','big',{entity:'forecast',actor:'u',at,before,after})]);assert.equal(entries.length,1);assert.equal(JSON.stringify(entries).includes('secret'),false);assert.equal(JSON.stringify(entries).includes('hidden'),false);assert.equal(Object.hasOwn(entries[0],'_rawBefore'),false);
});
test('unknown actor has an explicit filter rather than a fabricated account',()=>{
 const entries=normalizeTestLog([row('production_event','a',{kind:'start',recordedAt:at}),row('production_event','b',{kind:'start',actor:'known',recordedAt:at})]);assert.equal(filterTestLog(entries,new URLSearchParams({actor:'__unknown__'})).total,1);
});
test('persistence redaction retains complete non-secret values while response snapshots are bounded',()=>{
 const value={rows:Array.from({length:250},(_,i)=>({id:i,qty:i,token:'hidden'})),note:'a'.repeat(6500)};
 const stored=sanitizeTestLogValue(value,0,false),display=sanitizeTestLogValue(stored);assert.equal(stored.rows.length,250);assert.equal(stored.note.length,6500);assert.equal(JSON.stringify(stored).includes('hidden'),false);assert.equal(display.rows.length,201);assert.match(display.rows[200],/rút gọn/);assert.ok(display.note.length<6500);
});
test('feedback state diffs are reconstructed only from recorded fields; no-op feedback/permission setup omitted',()=>{
 const base={entity:'user_feedback',key:'F1',actor:'u',at,action:'FEEDBACK_UPDATED',change:{beforeStatus:'Mới',status:'Đã xử lý',beforeResponse:'',response:'Done'}};
 const entries=normalizeTestLog([row('admin_audit','f1',base),row('admin_audit','f2',{...base,change:{beforeStatus:'Mới',status:'Mới',beforeResponse:'',response:''}}),row('admin_audit','p1',{action:'USER_PERMISSION_SETUP',actor:'u',at,changes:[]})]);assert.equal(entries.length,1);assert.deepEqual(entries[0].before,{status:'Mới',response:''});assert.deepEqual(entries[0].after,{status:'Đã xử lý',response:'Done'});
});
test('source-aware addition classification includes transit rows, first labor setting and history imports',()=>{
 const entries=normalizeTestLog([row('in_transit_audit','a',{action:'add-lsx',recordId:'LSX1',actor:'u',at,changes:[{field:'lsxQty',before:null,after:5}]}),row('in_transit_audit','b',{action:'add-unplanned',recordId:'LSX2',actor:'u',at}),row('labor_hours_history','c',{sku:'SKU1',actor:'u',at,oldLaborHour:null,newLaborHour:1}),row('production_history_import','d',{actor:'u',createdAt:at,reports:[]})]);
 assert.equal(filterTestLog(entries,new URLSearchParams({action:'add'})).total,4);const labor=entries.find(e=>e.source==='labor_hours_history');assert.equal(labor.before,null);assert.equal(labor.hasBefore,true);
});
test('capacity decisions retain recorded outcome context even when input snapshots are identical',()=>{
 const entries=normalizeTestLog([row('capacity','week',{rows:[{line:'A',history:[{action:'review',decision:'reject',request:{status:'rejected',reviewReason:'Needs changes'},actor:'u',at,before:{workers:1},after:{workers:1}}]}]})]);assert.equal(entries.length,1);assert.equal(entries[0].summary.decision,'reject');assert.equal(entries[0].summary.request.status,'rejected');assert.equal(entries[0].summary.request.reviewReason,'Needs changes');
});
test('permission setup with identical business snapshots is omitted even if timestamp attribution changed',()=>{
 const entry={action:'USER_PERMISSION_SETUP',actor:'u',at,changes:[{entity:'users',key:'U',before:{name:'U',updatedAt:'old',updatedBy:'x'},after:{name:'U',updatedAt:'new',updatedBy:'y'}}]};assert.equal(normalizeTestLog([row('admin_audit','noop',entry)]).length,0);
});
test('Oct 16 Vietnam cutoff is mandatory for all queries and rejects invalid or absent event times',()=>{
 const dates=['2026-10-15T16:59:59.999Z','2026-10-15T17:00:00.000Z','2026-10-16T00:00:00+07:00','2026-10-16T17:00:00Z','2026-10-32T12:00:00Z','2026-10-16',null,'garbage','2026-10-15T24:00:00Z'];
 const entries=normalizeTestLog(dates.map((date,i)=>row('production_event',String(i),{kind:'start',actor:'u',recordedAt:date})));
 assert.deepEqual(filterTestLog(entries).entries.map(e=>e.sourceId).sort(),['1','2','3']);assert.equal(filterTestLog(entries,new URLSearchParams({from:'2000-01-01'})).total,3);assert.equal(filterTestLog(entries,new URLSearchParams({from:'2026-10-17'})).total,1);assert.equal(filterTestLog(entries,new URLSearchParams({to:'2026-10-15'})).total,0);
});
test('first labor setting is not duplicated when administrative and domain snapshots mirror one another',()=>{
 const entries=normalizeTestLog([row('admin_audit','admin',{entity:'labor_hours',key:'S1',actor:'u',at,before:null,after:{sku:'S1',laborHour:1,note:''}}),row('labor_hours_history','domain',{sku:'S1',actor:'u',at,oldLaborHour:null,newLaborHour:1,oldNote:'',newNote:''})]);assert.equal(entries.length,1);assert.equal(entries[0].action,'add');
});
test('malformed legacy nested history entries cannot break the audit screen',()=>{
 assert.doesNotThrow(()=>normalizeTestLog([row('admin_audit','bad',{entity:'in_transit',changes:[null],actor:'u',at}),row('capacity','c',{rows:[null,{line:'A',history:[null,{action:'save',before:{a:1},after:{a:2},actor:'u',at}]}]}),row('employees','e',{history:[null]})]));
});
test('mixed UTC and Vietnam timestamp strings sort by actual chronological instant',()=>{
 const entries=normalizeTestLog([row('production_event','earlier',{kind:'start',actor:'u',recordedAt:'2026-10-16T00:00:00+07:00'}),row('production_event','later',{kind:'start',actor:'u',recordedAt:'2026-10-15T23:00:00Z'})]);assert.deepEqual(entries.map(e=>e.sourceId),['later','earlier']);
});
test('import chunks resolve missing user only through their recorded parent batch',()=>{
 const records=[row('production_history_import','batch',{actorId:'u1',createdAt:at}),row('production_history_import','chunk',{parentBatchId:'batch',createdAt:at}),row('production_history_import','orphan',{parentBatchId:'absent',createdAt:at}),row('production_history_import','explicit',{parentBatchId:'batch',actorId:'u2',createdAt:at})];
 const values=normalizeTestLog(records,[{id:'u1',login:'user1',name:'User One'}]);
 assert.equal(values.find(v=>v.sourceId==='chunk').actor,'User One (user1)');assert.equal(values.find(v=>v.sourceId==='orphan').actorId,'');assert.equal(values.find(v=>v.sourceId==='explicit').actorId,'u2');
});

test('receipt projection preserves business record, result and authoritative identity',()=>{
 const [entry]=normalizeTestLog([{entity:'website_action_audit',record_key:'receipt-1',payload:{id:'receipt-1',entity:'production_report',record:'LSX-1',operation:'Xác nhận báo công',actorId:'cnphuong',at:'2026-10-20T03:00:00Z',outcome:'denied',evidence:'server',httpStatus:403}}]);
 assert.equal(entry.record,'LSX-1');assert.equal(entry.outcome,'denied');assert.equal(entry.actorId,'cnphuong');assert.equal(entry.operationId,'receipt-1');assert.equal(filterTestLog([entry],new URLSearchParams({outcome:'succeeded'})).total,0);assert.equal(filterTestLog([entry],new URLSearchParams({outcome:'denied'})).total,1);
});
test('recorded review status transition is labeled as report confirmation without inventing an event',()=>{
 const [entry]=normalizeTestLog([row('admin_audit','approval',{entity:'production_report',key:'REPORT1',actorId:'cnphuong',at,before:{reviewStatus:'Chờ kiểm tra'},after:{reviewStatus:'Đã xác nhận'}})]);assert.equal(entry.operation,'Xác nhận báo công');assert.equal(entry.menu,'Tiến độ SX');assert.equal(entry.action,'update');
});
