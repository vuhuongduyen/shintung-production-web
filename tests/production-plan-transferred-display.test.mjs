import * as backlog from '../lib/plan-transit-backlog.mjs';
import * as capacityConfirmation from '../lib/plan-capacity-confirmation.mjs';
import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import * as rules from '../lib/production-plan.mjs';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,records,root} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';

const week='2026-10-12';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=(id,status='ĐÃ CHỐT',overrides={})=>rules.normalizeRow({id,sku:id,name:id,status,line:'A',plan:10,laborHour:1,start:week,end:week,...overrides},week);
const data=(rows)=>({revision:3,rows,sources:[],capacity:[{week,line:'A',status:'Đã xác nhận',availableHours:100,version:1}],transit:rows.filter(r=>r.status==='ĐÃ CHUYỂN').map(r=>({...r,planRowId:r.id})),audit:[],warnings:[],canReopen:true});
const descendants=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children,node.props?.items].flat(Infinity).flatMap(descendants)];
const label=node=>Array.isArray(node)?node.map(label).join(''):node&&typeof node==='object'?label(node.props?.children):String(node??'');

// Run the real component's renders, effects and event callbacks with synthetic
// responses only. No browser session, server, credentials or database is used.
export function fixture(initial,props={},options={}) {
 const states=[],refs=[],effects=[],pending=[],requests=[],downloads=[];
 let cursor=0,refCursor=0,effectCursor=0,revision=0,invalidations=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...React,
  useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},
  useRef(initial){const i=refCursor++;return refs[i]??={current:initial};},
  useMemo(fn){return fn();},useContext(){return true;},
  useEffect(fn,deps){const i=effectCursor++,old=effects[i];if(!old||!same(old.deps,deps)){effects[i]={deps,cleanup:old?.cleanup};pending.push(()=>{old?.cleanup?.();effects[i].cleanup=fn();});}},
 };
 const fetch=(url,init={})=>new Promise((resolve,reject)=>requests.push({url,method:init.method||'GET',body:init.body,resolve,reject}));
 const toolbar={action:(props,children,allowed=true)=>allowed?React.createElement('button',props,children):null,field:(label,children)=>React.createElement('label',null,label,React.Children.toArray(children)),input:props=>React.createElement('input',props),select:(props,children)=>React.createElement('select',props,children),note:children=>React.createElement('span',null,children),group:children=>React.createElement(React.Fragment,null,React.Children.toArray(children))};
 const source=fs.readFileSync(new URL('../components/production-plan.tsx',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={},window=Object.assign(new EventTarget(),{setInterval:()=>1,setTimeout:()=>1,clearInterval(){},clearTimeout(){}});
 vm.runInNewContext(js,{exports,window,console,clearInterval(){},Blob,URL:{createObjectURL(blob){downloads.push(blob);return 'blob:synthetic';},revokeObjectURL(){}},document:{createElement:()=>({click(){}})},require(name){
  if(name.endsWith('action-feedback'))return name.includes('lib/')?actionFeedbackHelpers:actionFeedbackComponentFixture;
  if(name==='react')return hooks;if(name==='react/jsx-runtime')return jsxRuntime;
  if(name.includes('data-sync'))return {apiFetch:fetch,useDataRefresh:()=>revision,clientSessionGeneration:()=>0,subscribeClientReadInvalidation:()=>{},WorkspaceActivityContext:{}};
  if(name.includes('production-plan.mjs'))return rules;
  if(name.includes('plan-capacity-confirmation.mjs'))return capacityConfirmation;
  if(name.endsWith('plan-transit-backlog.mjs'))return backlog;
  // Display-only dialogs are not mounted by this hook/request harness.
  if(['./production-plan-rules','./plan-daily-load-warning','./capacity-day-detail'].includes(name))return {default:()=>null};
  if(name==='./plan-transit-backlog')return {PlanTransitBacklogDetail:()=>null};
  if(name.includes('in-transit'))return {invalidateInTransitCache(){invalidations++;}};
  if(name.includes('production-display-time'))return {productionDisplayTime:value=>value||'—'};
  if(name.includes('planning-display'))return {planningHours:options.planningHours||(value=>String(value??'—'))};
  if(name.includes('DataCell'))return {DataCell:props=>React.createElement('td',Object.fromEntries(Object.entries(props).filter(([key])=>key!=='kind')))};
  if(name.includes('ManualPagination'))return {ManualPagination:()=>null};
  if(name.includes('StandardToolbar'))return {toolbar,StandardToolbar:({items})=>React.createElement('nav',null,React.Children.toArray(items))};
  if(name.includes('planning-feedback'))return {default:({message})=>React.createElement('p',null,message)};
  if(name.includes('capacity-confirm-panel'))return {default:()=>null};
  throw Error(name);
 }});
 exports.refreshTransferredPlan(week,initial);
 const render=()=>{cursor=0;refCursor=0;effectCursor=0;return exports.ProductionPlan({initialWeek:week,...props});};
 const commit=()=>{const tree=render();while(pending.length)pending.shift()();return tree;};
 const find=predicate=>descendants(render()).find(predicate);
 const button=text=>find(node=>node.type==='button'&&label(node)===text);
 const input=aria=>find(node=>node.props?.['aria-label']===aria);
 const table=()=>find(node=>node.type==='table'&&node.props.className==='pp-plan-grid');
 const ids=()=>JSON.parse(table().props['data-report-source']).rows.map(r=>r[1]);
 const selectFilter=(field,value)=>{if(button('Tra cứu')){button('Tra cứu').props.onClick();commit();}find(node=>node.type==='select'&&!node.props['aria-label']).props.onChange({target:{value:field}});commit();input(field==='query'?'Search plan':`Filter ${field}`).props.onChange({target:{value}});commit();};
 const selectStatus=status=>selectFilter('status',status);
 const cards=()=>descendants(render()).filter(node=>node.type==='article'&&node.props.className?.includes('pp-load-card')).map(card=>({line:label(descendants(card).find(node=>node.type==='h3')).split(' ')[1],values:descendants(card).filter(node=>node.type==='dd').map(label),load:label(descendants(card).find(node=>node.type==='b')),warning:card.props.className}));
 const settle=async(request,body,status=200)=>{assert.ok(request);request.resolve(new Response(JSON.stringify(body),{status}));await tick();commit();};
 const start=async()=>{commit();await settle(requests.find(r=>r.url===`/api/production-plan?week=${week}`),initial);for(const request of requests.filter(r=>r.url.includes('capacityOnly')||r.url==='/api/capacity?requests=1'))await settle(request,request.url.includes('capacityOnly')?{capacity:initial.capacity}:{requests:[]});};
 return {render,commit,button,input,find,ids,selectStatus,selectFilter,cards,requests,downloads,settle,start,html:()=>renderToStaticMarkup(render()),invalidations:()=>invalidations,poll(){revision++;commit();},selectAll(){input('Select page').props.onChange({target:{checked:true}});commit();},async transfer(){button('Chuyển sang In Transit').props.onClick();await tick();commit();return requests.at(-1);}};
}

test('default working list hides transferred rows in table, report, pagination and export without losing capacity/history',async()=>{
 const original=data([row('TRANSFERRED','ĐÃ CHUYỂN',{plan:20}),row('DRAFT','DỰ KIẾN'),row('CLOSED'),row('CANCELLED','HỦY'),row('DEFERRED','TẠM HOÃN')]);
 const before=structuredClone(original),f=fixture(original);await f.start();
 assert.deepEqual(f.ids(),['CANCELLED','CLOSED','DEFERRED','DRAFT']);
 assert.equal(f.input('Select TRANSFERRED'),undefined);
 assert.equal(f.find(node=>node.type?.name==='ManualPagination').props.total,4);
 assert.deepEqual(f.cards()[0].values,['20','20','100','60'],'list hours exclude transferred/cancelled/deferred; weekly allocation remains committed');
 f.button('Xuất Excel (.xml)').props.onClick();const xml=await f.downloads.at(-1).text();
 assert.match(xml,/CLOSED/);assert.doesNotMatch(xml,/TRANSFERRED/);assert.match(xml,/CANCELLED/);assert.match(xml,/DEFERRED/);
 assert.deepEqual(original,before,'display filtering must not mutate source records');
});

test('explicit history remains accessible, but transferred rows cannot join bulk operations',async()=>{
 const f=fixture(data([row('TRANSFERRED','ĐÃ CHUYỂN'),row('CLOSED')]));await f.start();f.selectStatus('all');
 assert.deepEqual(f.ids(),['CLOSED','TRANSFERRED']);assert.equal(f.input('Select TRANSFERRED').props.disabled,true);
 f.selectAll();assert.equal(f.input('Select CLOSED').props.checked,true);assert.equal(f.input('Select TRANSFERRED').props.checked,false);
 const request=await f.transfer();assert.equal(request.method,'POST');assert.deepEqual(JSON.parse(request.body).ids,['CLOSED']);
 await f.settle(request,{error:'cannotTransfer'},422);
 f.selectStatus('ĐÃ CHUYỂN');assert.deepEqual(f.ids(),['TRANSFERRED']);f.selectAll();assert.equal(f.button('Chuyển sang In Transit').props.disabled,true);assert.equal(f.button('Mở chốt').props.disabled,true);
});

test('clear filters and Back return to the active working view',async()=>{
 for(const reset of ['Xóa lọc','Quay lại']){
  const f=fixture(data([row('TRANSFERRED','ĐÃ CHUYỂN'),row('CLOSED')]));await f.start();f.selectStatus('all');assert.equal(f.ids().length,2);
  f.button(reset).props.onClick();f.commit();assert.deepEqual(f.ids(),['CLOSED']);
 }
});

test('confirmed transfer refresh hides only the transferred selection and keeps all source/history data',async()=>{
 const initial=data([row('SELECTED'),row('UNSELECTED')]);const f=fixture(initial);await f.start();
 f.input('Select SELECTED').props.onChange();f.commit();const write=await f.transfer();
 assert.deepEqual(JSON.parse(write.body).ids,['SELECTED']);
 await f.settle(write,{revision:4,added:1,updated:1,existing:0});
 const fresh={...data([row('SELECTED','ĐÃ CHUYỂN'),row('UNSELECTED')]),revision:4,audit:[{id:'SYNTHETIC-AUDIT',action:'transfer',at:'2026-10-15T00:00:00Z',actor:'TEST',reason:'',before:initial.rows,after:[row('SELECTED','ĐÃ CHUYỂN'),row('UNSELECTED')]}]};
 await f.settle(f.requests.at(-1),fresh);
 assert.deepEqual(f.ids(),['UNSELECTED']);assert.equal(f.invalidations(),1);assert.match(f.html(),/Lịch sử thao tác \(1\)/);
 f.selectStatus('all');assert.deepEqual(f.ids(),['SELECTED','UNSELECTED']);assert.equal(fresh.transit.length,1);assert.equal(fresh.audit.length,1);
});

test('rejected transfer never hides or marks any selected row as transferred',async()=>{
 const f=fixture(data([row('SELECTED'),row('OTHER')]));await f.start();f.selectAll();const request=await f.transfer();
 await f.settle(request,{error:'cannotTransfer'},422);
 assert.deepEqual(f.ids(),['OTHER','SELECTED']);assert.equal(f.invalidations(),0);assert.equal(f.requests.at(-1),request);
});

test('fresh background state removes transferred rows and a re-opened menu keeps them hidden',async()=>{
 const f=fixture(data([row('REMOTE')]));await f.start();f.poll();const fresh={...data([row('REMOTE','ĐÃ CHUYỂN')]),revision:4};
 await f.settle(f.requests.at(-1),fresh);assert.deepEqual(f.ids(),[]);assert.equal(f.find(node=>node.type?.name==='ManualPagination').props.total,0);
 const reopened=fixture(fresh);assert.deepEqual(reopened.ids(),[]);reopened.selectStatus('ĐÃ CHUYỂN');assert.deepEqual(reopened.ids(),['REMOTE']);
});

test('active-filter label and transferred exclusion agree in Vietnamese, Chinese and English',async()=>{
 for(const [language,text] of [['vi','Chưa chuyển In Transit'],['zh','未轉入在途'],['en','Not transferred to In Transit']]){
  const f=fixture(data([row('TRANSFERRED','ĐÃ CHUYỂN'),row('CLOSED')]),{language});await f.start();f.selectStatus('active');
  assert.deepEqual(f.ids(),['CLOSED']);
  assert.equal(label(descendants(f.input('Filter status')).find(node=>node.type==='option'&&node.props.value==='active')),text);
 }
});

test('a committed transfer with failed readback keeps the existing uncertainty warning until a verified refresh',async()=>{
 const f=fixture(data([row('SELECTED')]));await f.start();f.selectAll();const request=await f.transfer();
 await f.settle(request,{revision:4,added:1,updated:1,existing:0});
 await f.settle(f.requests.at(-1),{error:'syntheticUnavailable'},503);
 assert.deepEqual(f.ids(),['SELECTED'],'do not invent a row state when readback failed');
 assert.match(f.html(),/Máy chủ đã nhận thao tác nhưng chưa tải lại được kết quả/);
 f.button('Tải lại dữ liệu').props.onClick();await tick();
 await f.settle(f.requests.at(-1),{...data([row('SELECTED','ĐÃ CHUYỂN')]),revision:4});assert.deepEqual(f.ids(),[]);
});

test('transfer handler rejects draft, deferred, cancelled and mixed selections even through a stale callback',async()=>{
 for(const status of ['DỰ KIẾN','TẠM HOÃN','HỦY']){
  const f=fixture(data([row('UNCONFIRMED',status),row('CONFIRMED')]));await f.start();f.selectStatus('all');
  f.input('Select UNCONFIRMED').props.onChange();f.commit();
  assert.equal(f.button('Chuyển sang In Transit').props.disabled,true);
  await f.transfer();assert.equal(f.requests.filter(request=>request.method==='POST').length,0);
  assert.deepEqual(f.ids(),['CONFIRMED','UNCONFIRMED']);
  f.input('Select CONFIRMED').props.onChange();f.commit();
  assert.equal(f.button('Chuyển sang In Transit').props.disabled,true);
  await f.transfer();assert.equal(f.requests.filter(request=>request.method==='POST').length,0);
  assert.match(f.html(),/Chỉ chuyển dòng đã chốt và đủ dữ liệu/);
 }
});

test('confirmed transfer submits once for rapid repeat callbacks and stale successful callbacks cannot submit again',async()=>{
 const f=fixture(data([row('CONFIRMED')]));await f.start();f.selectAll();
 const transfer=f.button('Chuyển sang In Transit');assert.equal(transfer.props.disabled,false);
 transfer.props.onClick();transfer.props.onClick();await tick();f.commit();
 const writes=()=>f.requests.filter(request=>request.method==='POST');assert.equal(writes().length,1);
 assert.deepEqual(f.ids(),['CONFIRMED'],'row remains visible while request is pending');
 await f.settle(writes()[0],{revision:4,added:1,updated:1,existing:0});
 transfer.props.onClick();await tick();assert.equal(writes().length,1,'readback is still part of the pending operation');
 await f.settle(f.requests.at(-1),{...data([row('CONFIRMED','ĐÃ CHUYỂN')]),revision:4});assert.deepEqual(f.ids(),[]);
 transfer.props.onClick();await tick();f.commit();assert.equal(writes().length,1,'old callback rechecks authoritative status');
});

test('failed transfer releases the immediate latch for a deliberate retry without hiding rows',async()=>{
 const f=fixture(data([row('CONFIRMED')]));await f.start();f.selectAll();const first=await f.transfer();
 await f.settle(first,{error:'cannotTransfer'},422);assert.deepEqual(f.ids(),['CONFIRMED']);
 assert.equal(f.button('Chuyển sang In Transit').props.disabled,false);
 const retry=await f.transfer();assert.equal(retry.method,'POST');assert.notEqual(retry,first);
 assert.equal(f.requests.filter(request=>request.method==='POST').length,2);
 await f.settle(retry,{error:'conflict'},409);assert.deepEqual(f.ids(),['CONFIRMED']);
});

test('network failure keeps the confirmed selection and permits checking or retrying',async()=>{
 const f=fixture(data([row('CONFIRMED')]));await f.start();f.selectAll();const request=await f.transfer();
 request.reject(new Error('synthetic network failure'));await tick();f.commit();
 assert.deepEqual(f.ids(),['CONFIRMED']);assert.equal(f.input('Select CONFIRMED').props.checked,true);
 assert.equal(f.button('Chuyển sang In Transit').props.disabled,false);
 assert.match(f.html(),/Chưa xác nhận được kết quả do lỗi kết nối/);
});

test('default retains cancelled and deferred rows, visibly marked, after reset and Back without reserving their hours',async()=>{
 const initial=data([row('102TC06001','HỦY',{plan:250,laborHour:.05}),row('102TC10002','HỦY',{plan:20,laborHour:.034}),row('102TC10003','HỦY',{plan:2,laborHour:null}),row('DEFERRED','TẠM HOÃN'),row('TRANSFERRED','ĐÃ CHUYỂN')]);
 const f=fixture(initial);await f.start();
 for(const reset of [null,'Xóa lọc','Quay lại']){
  if(reset){f.selectStatus('ĐÃ CHUYỂN');f.button(reset).props.onClick();f.commit();}
  assert.deepEqual(f.ids(),['102TC06001','102TC10002','102TC10003','DEFERRED']);
  assert.deepEqual(f.cards()[0].values,['0','10','100','90']);
  assert.equal(f.input('Status 102TC06001').props.value,'HỦY');assert.equal(f.input('Status DEFERRED').props.value,'TẠM HOÃN');
  assert.ok(descendants(f.render()).some(node=>node.type==='tr'&&node.props.className==='pp-cancelled'));
  f.selectAll();assert.equal(f.button('Chuyển sang In Transit').props.disabled,true);
  await f.transfer();assert.equal(f.requests.filter(request=>request.method==='POST').length,0);
 }
 assert.equal(f.cards()[0].warning,'data-card pp-load-card ok','cancelled missing labor is not an allocated-capacity warning');
});

test('22 transferred rows leave zero list hours, retain weekly overload and reappear across history pages without double counting',async()=>{
 const transferred=[...Array.from({length:11},(_,i)=>row(`A-${i}`,'ĐÃ CHUYỂN',{plan:i===10?18.5:50})),...Array.from({length:11},(_,i)=>row(`B-${i}`,'ĐÃ CHUYỂN',{line:'B',plan:i===10?52:50}))];
 const initial={...data(transferred),capacity:[{week,line:'A',status:'Đã xác nhận',availableHours:430.825,version:1},{week,line:'B',status:'Đã xác nhận',availableHours:517.275,version:1}]};
 const f=fixture(initial);await f.start();assert.deepEqual(f.ids(),[]);
 assert.deepEqual(f.cards().map(card=>card.values),[['0','518.5','430.825',String(430.825-518.5)],['0','552','517.275',String(517.275-552)]]);
 assert.deepEqual(f.cards().map(card=>card.load),['Tải tuần · 120.4%','Tải tuần · 106.7%']);
 assert.ok(f.cards().every(card=>card.warning.endsWith('overload')));
 f.selectStatus('ĐÃ CHUYỂN');assert.equal(f.ids().length,22);
 assert.equal(f.find(node=>node.type?.name==='ManualPagination').props.total,22);
 assert.deepEqual(f.cards().map(card=>card.values.slice(0,2)),[['518.5','0'],['552','0']]);
 f.find(node=>node.type?.name==='ManualPagination').props.onPageChange(2);f.commit();
 assert.deepEqual(f.cards().map(card=>card.values.slice(0,2)),[['518.5','0'],['552','0']],'summary covers all filtered rows, not just the current page');
});

test('status, SKU and type filters partition workload while weekly capacity, balance and load remain invariant',async()=>{
 const initial=data([row('DRAFT','DỰ KIẾN',{plan:5}),row('MAIN','ĐÃ CHỐT',{plan:10}),row('CARRY','ĐÃ CHỐT',{plan:15,type:'GỐI ĐẦU'}),row('TRANSFERRED','ĐÃ CHUYỂN',{plan:20}),row('CANCELLED','HỦY',{plan:99}),row('DEFERRED','TẠM HOÃN',{plan:99})]);
 const f=fixture(initial);await f.start();
 const check=(visible,outside)=>{const card=f.cards()[0];assert.deepEqual(card.values,[String(visible),String(outside),'100','50']);assert.equal(card.load,'Tải tuần · 50.0%');};
 check(30,20);
 for(const [status,visible,outside] of [['all',50,0],['ĐÃ CHUYỂN',20,30],['ĐÃ CHỐT',25,25],['DỰ KIẾN',5,45],['HỦY',0,50],['TẠM HOÃN',0,50],['active',30,20]]){f.selectStatus(status);check(visible,outside);}
 f.selectFilter('type','GỐI ĐẦU');assert.deepEqual(f.ids(),['CARRY']);check(15,35);
 f.selectFilter('query','NO-MATCH');assert.deepEqual(f.ids(),[]);check(0,50);
 f.button('Xóa lọc').props.onClick();f.commit();check(30,20);
 f.selectFilter('query','MAIN');assert.deepEqual(f.ids(),['MAIN']);check(10,40);
});

test('Line filters preserve each whole-line allocation including a completely hidden Line C',async()=>{
 const initial=data([row('A-CLOSED'),row('A-TRANSFERRED','ĐÃ CHUYỂN',{plan:20}),row('B-CLOSED','ĐÃ CHỐT',{line:'B',plan:40}),row('C-TRANSFERRED','ĐÃ CHUYỂN',{line:'C',plan:50})]);
 initial.capacity=['A','B','C'].map(line=>({week,line,status:'Đã xác nhận',availableHours:100,version:1}));
 const f=fixture(initial);await f.start();assert.deepEqual(f.cards().map(card=>card.line),['A','B','C']);
 for(const [line,values] of [['A',['10','20','100','70']],['B',['40','0','100','60']],['C',['0','50','100','50']]]){f.selectFilter('line',line);assert.equal(f.cards().length,1);assert.equal(f.cards()[0].line,line);assert.deepEqual(f.cards()[0].values,values);}
});

test('switching weeks does not reuse hours from the previous week and cached return keeps the correct partition',async()=>{
 const initial=data([row('W42','ĐÃ CHUYỂN',{plan:40})]),f=fixture(initial);await f.start();
 const next='2026-10-19';f.input('Plan week').props.onChange({target:{value:next}});f.commit();
 const other={...data([row('W43','ĐÃ CHỐT',{week:next,plan:15})]),capacity:[{week:next,line:'A',status:'Đã xác nhận',availableHours:80,version:2}]};
 await f.settle(f.requests.find(request=>request.url===`/api/production-plan?week=${next}`),other);
 assert.deepEqual(f.ids(),['W43']);assert.deepEqual(f.cards()[0].values,['15','0','80','65']);
 f.input('Plan week').props.onChange({target:{value:week}});f.commit();
 assert.deepEqual(f.cards()[0].values,['0','40','100','60']);
 await f.settle(f.requests.filter(request=>request.url===`/api/production-plan?week=${week}`).at(-1),initial);
 assert.deepEqual(f.ids(),[]);assert.deepEqual(f.cards()[0].values,['0','40','100','60']);
});

test('null quantities, missing labor, soft-deleted rows and other weeks retain honest independent partitions',()=>{
 const capacity=[{week,line:'A',status:'Đã xác nhận',availableHours:100,version:1}];
 const visible=row('KNOWN','ĐÃ CHỐT',{plan:10}),unknown=row('UNKNOWN','ĐÃ CHUYỂN',{plan:null});
 let [result]=rules.viewSummary([visible,unknown],[visible],capacity,week);
 assert.equal(result.listedRequired,10);assert.equal(result.outsideRequired,null);assert.equal(result.required,null);assert.equal(result.difference,null);assert.equal(result.ratio,null);
 [result]=rules.viewSummary([visible,unknown],[unknown],capacity,week);
 assert.equal(result.listedRequired,null);assert.equal(result.outsideRequired,10);
 const missing=row('MISSING','ĐÃ CHUYỂN',{laborHour:null});
 [result]=rules.viewSummary([visible,missing,row('DELETED','ĐÃ CHUYỂN',{_deleted:true,plan:999}),row('OTHER-WEEK','ĐÃ CHUYỂN',{week:'2026-10-19',plan:999})],[visible],capacity,week);
 assert.deepEqual([result.listedRequired,result.outsideRequired,result.required,result.difference,result.missingLabor],[10,0,10,90,1]);assert.equal(result.warning,'missing');
 [result]=rules.viewSummary([visible,missing],[visible],[{...capacity[0],status:'Chờ KHSX đồng ý'}],week);
 assert.equal(result.available,null);assert.equal(result.difference,null);assert.equal(result.ratio,null);
 [result]=rules.viewSummary([visible],[visible],[{...capacity[0],availableHours:0}],week);
 assert.equal(result.ratio,Infinity);assert.equal(result.difference,-10);
});

test('pending, rejected, uncertain and verified transfers change card partitions only after authoritative readback',async()=>{
 const initial=data([row('SELECTED','ĐÃ CHỐT',{plan:30}),row('OTHER','ĐÃ CHỐT',{plan:20})]),f=fixture(initial);await f.start();
 f.input('Select SELECTED').props.onChange();f.commit();const first=await f.transfer();
 const before=['50','0','100','50'];assert.deepEqual(f.cards()[0].values,before);
 await f.settle(first,{error:'cannotTransfer'},422);assert.deepEqual(f.cards()[0].values,before);
 const next=await f.transfer();await f.settle(next,{revision:4,added:1,updated:1,existing:0});assert.deepEqual(f.cards()[0].values,before);
 await f.settle(f.requests.at(-1),{error:'unavailable'},503);assert.deepEqual(f.cards()[0].values,before);
 f.button('Tải lại dữ liệu').props.onClick();await tick();
 const fresh={...data([row('SELECTED','ĐÃ CHUYỂN',{plan:30}),row('OTHER','ĐÃ CHỐT',{plan:20})]),revision:4};
 await f.settle(f.requests.at(-1),fresh);assert.deepEqual(f.cards()[0].values,['20','30','100','50']);assert.equal(f.cards()[0].load,'Tải tuần · 50.0%');
 f.selectAll();const last=await f.transfer();await f.settle(last,{revision:5,added:1,updated:1,existing:0});
 await f.settle(f.requests.at(-1),{...data(fresh.rows.map(item=>({...item,status:'ĐÃ CHUYỂN'}))),revision:5});
 assert.deepEqual(f.ids(),[]);assert.deepEqual(f.cards()[0].values,['0','50','100','50']);
});

test('real API and isolated TEST database: partial transfer updates rendered totals, preserves capacity/history, and retry cannot duplicate',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const connection=await openDatabase(mkdtempSync(resolve(base,'plan-summary-')));
 const login='plan-summary@example.test';let cookie='';
 const api=(url,body)=>siteApi(new Request(`https://test.invalid${url}`,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'content-type':'application/json',origin:'https://test.invalid'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:connection.db,FILES:connection.bucket});
 try{
  await migrate(connection.db);const password=await passwordRecord('1234');
  const initial=data([row('SELECTED','ĐÃ CHỐT',{plan:30}),row('OTHER','ĐÃ CHỐT',{plan:20}),row('CANCELLED','HỦY',{plan:99})]);
  await connection.db.batch([
   connection.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,email:login,role:'Super Admin',active:true}),login,'TEST'),
   connection.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,password.hash,password.salt,password.iterations,'TEST'),
   connection.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan',week,JSON.stringify({schemaVersion:1,week,revision:3,rows:initial.rows}),login,'TEST'),
   connection.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity',week,JSON.stringify({schemaVersion:1,week,rows:initial.capacity}),login,'TEST'),
  ]);
  const signed=await api('/api/auth/login',{login,password:'1234'});assert.equal(signed.status,200);cookie=signed.headers.get('set-cookie').split(';')[0];
  const read=()=>api(`/api/production-plan?week=${week}`);
  const loaded=await read();assert.equal(loaded.status,200);const stored=await loaded.json();
  const untouched=(await records(connection.db)).filter(record=>!['production_plan','production_plan_audit','in_transit'].includes(record.entity));
  const f=fixture(stored);await f.start();assert.deepEqual(f.cards()[0].values,['50','0','100','50']);assert.ok(f.ids().includes('CANCELLED'));
  const rejected=await api('/api/production-plan',{action:'transfer',week,revision:stored.revision,ids:['SELECTED','CANCELLED']});assert.equal(rejected.status,422);
  assert.deepEqual((await(await read()).json()).rows,stored.rows,'mixed rejected batch preserves all plans');
  f.input('Select SELECTED').props.onChange();f.commit();const write=await f.transfer();
  const result=await api(write.url,JSON.parse(write.body));assert.equal(result.status,200);write.resolve(result);await tick();f.commit();
  assert.deepEqual(f.cards()[0].values,['50','0','100','50'],'successful POST alone does not fabricate verified state');
  const refresh=f.requests.at(-1);refresh.resolve(await api(refresh.url));await tick();f.commit();
  assert.deepEqual(f.ids(),['CANCELLED','OTHER']);assert.deepEqual(f.cards()[0].values,['20','30','100','50']);
  const after=await(await read()).json();assert.equal(after.transit.length,1);assert.equal(after.audit.length,1);assert.equal(after.rows.length,3);
  const repeated=await api('/api/production-plan',{action:'transfer',week,revision:after.revision,ids:['SELECTED']});assert.equal(repeated.status,200);
  const final=await(await read()).json();assert.equal(final.transit.length,1);assert.equal(final.audit.length,1);assert.deepEqual(final.rows,after.rows);
  assert.deepEqual((await records(connection.db)).filter(record=>!['production_plan','production_plan_audit','in_transit'].includes(record.entity)),untouched,'capacity and unrelated records stay byte-for-byte unchanged');
  assert.deepEqual(rules.summary(stored.rows,stored.capacity,week),rules.summary(final.rows,final.capacity,week),'weekly allocated load survives transfer');
 }finally{await connection.close();}
});

test('row status changes cannot finalize a plan; only the explicit close toolbar action can',async()=>{
 const draft=row('DRAFT','DỰ KIẾN');const f=fixture(data([draft]));await f.start();
 const status=f.input('Status DRAFT');
 assert.deepEqual(descendants(status).filter(node=>node.type==='option').map(node=>node.props.value),['DỰ KIẾN','TẠM HOÃN','HỦY']);
 assert.equal(f.button('Chốt kế hoạch').props.disabled,true);
 status.props.onChange({target:{value:'ĐÃ CHỐT'}});f.commit();await tick();
 assert.equal(f.input('Status DRAFT').props.value,'DỰ KIẾN','invalid dropdown values cannot optimistically confirm');
 assert.equal(f.requests.filter(request=>request.method==='POST').length,0);
 f.input('Select DRAFT').props.onChange();f.commit();
 const close=f.button('Chốt kế hoạch');assert.equal(close.props.disabled,false);
 close.props.onClick();close.props.onClick();await tick();f.commit();
 const writes=f.requests.filter(request=>request.method==='POST');assert.equal(writes.length,1);
 assert.equal(JSON.parse(writes[0].body).action,'close');assert.deepEqual(JSON.parse(writes[0].body).ids,['DRAFT']);assert.deepEqual(JSON.parse(writes[0].body).edits,{},'unchanged UI close sends no editable fields');
 assert.equal(JSON.parse(f.find(node=>node.type==='table'&&node.props.className==='pp-plan-grid').props['data-report-source']).rows[0][13],'Dự kiến','wait for server confirmation');
 const confirmed={...draft,status:'ĐÃ CHỐT',closedAt:'2026-10-16T06:14:48.940Z',closedBy:'TEST'};
 await f.settle(writes[0],{revision:4,rows:[confirmed],updated:1});
 assert.equal(f.input('Status DRAFT'),undefined,'confirmed status is read-only text');
 assert.equal(f.input('Quantity DRAFT').props.disabled,true);
 assert.equal(JSON.parse(f.find(node=>node.type==='table'&&node.props.className==='pp-plan-grid').props['data-report-source']).rows[0][13],'Đã chốt');
 f.input('Select DRAFT').props.onChange();f.commit();
 assert.equal(f.button('Mở chốt').props.disabled,false);
 assert.equal(f.button('Chuyển sang In Transit').props.disabled,false);
});

test('rejected explicit close retains draft status and can be deliberately retried',async()=>{
 const f=fixture(data([row('DRAFT','DỰ KIẾN')]));await f.start();f.selectAll();
 f.button('Chốt kế hoạch').props.onClick();await tick();f.commit();
 const request=f.requests.at(-1);assert.equal(JSON.parse(request.body).action,'close');
 await f.settle(request,{error:'capacityUnconfirmed'},422);
 assert.equal(f.input('Status DRAFT').props.value,'DỰ KIẾN');
 assert.equal(f.input('Quantity DRAFT').props.disabled,false);
 assert.equal(f.button('Chốt kế hoạch').props.disabled,false);
 assert.equal(f.button('Chuyển sang In Transit').props.disabled,true);
 f.button('Chốt kế hoạch').props.onClick();await tick();f.commit();
 assert.equal(f.requests.filter(request=>request.method==='POST').length,2);
});

test('draft deferred and cancelled choices remain editable without a close request',async()=>{
 for(const next of ['TẠM HOÃN','HỦY','DỰ KIẾN']){
  const f=fixture(data([row('EDITABLE',next==='DỰ KIẾN'?'TẠM HOÃN':'DỰ KIẾN')]));await f.start();
  f.input('Status EDITABLE').props.onChange({target:{value:next}});f.commit();
  assert.equal(f.input('Status EDITABLE').props.value,next);
  assert.equal(f.requests.filter(request=>request.method==='POST').length,0);
  f.button('Tải lại dữ liệu').props.onClick();await tick();f.commit();
  const request=f.requests.at(-1),body=JSON.parse(request.body);
  assert.equal(body.action,'save');assert.equal(body.edits.EDITABLE.status,next);
 }
});

test('reopen stays visible with a precise disabled reason and respects transferred locks',async()=>{
 const source=fs.readFileSync(new URL('../components/production-plan.tsx',import.meta.url),'utf8');
 assert.match(source,/<StandardToolbar name="ProductionPlan" permissionFeedback/);
 const f=fixture(data([row('CLOSED'),row('DRAFT','DỰ KIẾN'),row('TRANSFERRED','ĐÃ CHUYỂN')]));await f.start();
 assert.equal(f.button('Mở chốt').props.disabled,true);assert.match(f.button('Mở chốt').props.title,/Chọn dòng đã chốt/);
 f.input('Select DRAFT').props.onChange();f.commit();assert.match(f.button('Mở chốt').props.title,/Chỉ mở chốt/);
 f.input('Select DRAFT').props.onChange();f.input('Select CLOSED').props.onChange();f.commit();assert.equal(f.button('Mở chốt').props.disabled,false);
 const blocked=fixture({...data([row('CLOSED')]),canReopen:false});await blocked.start();blocked.selectAll();
 assert.equal(blocked.button('Mở chốt').props.disabled,true);assert.match(blocked.button('Mở chốt').props.title,/Cần quyền Hủy xác nhận/);
 const linked=fixture(data([row('LINKED','ĐÃ CHỐT',{transferredAt:'2026-10-16T06:14:48.940Z'})]));await linked.start();linked.selectAll();
 assert.equal(linked.button('Mở chốt').props.disabled,true);assert.match(linked.button('Mở chốt').props.title,/đã chuyển In Transit/);
 f.selectStatus('all');assert.equal(f.input('Select TRANSFERRED').props.disabled,true);
});


test('reopen disabled reason is localized without an extra banner',async()=>{
 for(const [language,reason] of [['zh','請選取已確認的計畫以解除確認。'],['en','Select a confirmed plan to reopen.']]){
  const f=fixture(data([row('CLOSED')]),{language});await f.start();
  const reopen=f.button(language==='zh'?'解除確認':'Mở chốt');
  assert.equal(reopen.props.disabled,true);assert.equal(reopen.props.title,reason);
 }
});
