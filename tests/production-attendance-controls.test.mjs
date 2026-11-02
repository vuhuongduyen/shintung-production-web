import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as controls from '../lib/production-attendance-controls.mjs';
import * as scheduleHeadcount from '../lib/production-schedule-headcount.mjs';
import * as attendance from '../lib/production-attendance.mjs';
import * as eventDuration from '../lib/production-event-duration.mjs';
import * as eventEmployees from '../lib/production-event-employees.mjs';
// Load the real lookup helpers, rather than substituting a second filter implementation.
function loadLookupSource(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error(`Unexpected lookup dependency ${name}`);return imports[name];}});return exports;}
const lookupText=loadLookupSource('../lib/lookup-text.ts');
const employeeLookup=loadLookupSource('../lib/employee-lookup.ts',{'./lookup-text':lookupText});
const HR={hr:true,manager:false},MANAGER={hr:false,manager:true},ADMIN={hr:true,manager:true};
const entry={id:'TEST-ENTRY',kind:'line-absence',absenceType:'Nghỉ',line:'A',employees:['TEST-NV'],effectiveAt:'2026-10-12T01:00:00Z',endsAt:'2026-10-12T10:00:00Z'};
const descendants=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children,node.props?.items].flat(Infinity).flatMap(descendants)];
// Real component hooks and callbacks, with synthetic state and no server/network writes.
function fixture(file,initial){
 const states=[],effects=[],pending=[];let cursor=0,effectCursor=0,props=initial;const saves=[];
 const hooks={...React,useMemo:fn=>fn(),useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useEffect(fn,deps){const i=effectCursor++,old=effects[i];if(!old||!deps.every((v,j)=>Object.is(v,old[j]))){effects[i]=deps;pending.push(fn);}}};
 const toolbar={note:children=>React.createElement('span',null,children),action:(props,label,allowed=true)=>allowed?React.createElement('button',props,label):null,field:(label,children)=>React.createElement('label',null,label,children),input:props=>React.createElement('input',props),select:(props,children)=>React.createElement('select',props,children)};
 const exports={};const js=ts.transpileModule(fs.readFileSync(new URL('../components/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,console,require(name){
  if(name.includes('employee-lookup'))return employeeLookup;if(name.endsWith('action-feedback'))return name.includes('lib/')?actionFeedbackHelpers:actionFeedbackComponentFixture;if(name==='react')return hooks;if(name==='react/jsx-runtime')return jsxRuntime;if(name.includes('attendance-controls'))return controls;if(name.includes('production-schedule-headcount'))return scheduleHeadcount;if(name.includes('production-attendance.mjs'))return attendance;if(name.includes('event-employees'))return eventEmployees;if(name.includes('production-event-duration'))return eventDuration;if(name.includes('production-display-time'))return {productionDisplayTime:value=>value};if(name.includes('request-id'))return {productionRequestId:()=> 'TEST-ID'};if(name.includes('production-plan'))return {weekNumber:()=>42};if(name.includes('StandardToolbar'))return {toolbar,StandardToolbar:'Toolbar'};if(name.includes('popover'))return {Popover:'Popover',PopoverTrigger:'PopoverTrigger',PopoverContent:'PopoverContent'};if(name.includes('DataCell'))return {DataCell:'td'};if(name.includes('DataTable'))return {DataTable:'div'};if(name.endsWith('.css'))return {};return {default:name};}});
 const render=()=>{cursor=0;effectCursor=0;return exports.default({...props,save:async body=>{saves.push(body);return true;}});};
 const commit=()=>{render();while(pending.length)pending.shift()();return render();};
 const nodes=()=>descendants(render());
 return {render,commit,nodes,saves,change(next,flush=true){props={...props,...next};return flush?commit():render();},find:predicate=>nodes().find(predicate),button:label=>nodes().find(n=>n.type==='button'&&n.props.children===label)};
}
const schedule=rights=>fixture('actual-work-schedule.tsx',{week:'2026-10-12',line:'A',locked:false,days:[{date:'2026-10-12',working:false}],version:1,approved:{workers:1},approvedSchedules:[],history:[],events:[entry],orders:[],employees:[{id:'TEST-NV',name:'Test',line:'A'}],busy:false,...rights});
const tabNames=f=>f.nodes().filter(n=>n.props?.role==='tab').map(n=>n.props.children);

test('HR uses one entry button; managers and combined/Admin retain warehouse/transfer tabs',()=>{
 for(const [rights,expected] of [[HR,[]],[MANAGER,['Phụ kho','Chuyển Line']],[ADMIN,['Phụ kho','Chuyển Line']]]){const f=schedule(rights);f.commit();assert.deepEqual(tabNames(f),expected);}
 const f=schedule({hr:false,manager:false});f.commit();assert.deepEqual(tabNames(f),[]);assert.equal(f.nodes().some(n=>n.type==='form'),false);
});
test('HR lookup choices exclude production actions and rejects a stale/forged lookup value',()=>{
 const f=schedule(HR);f.commit();f.button('Tổng hợp tháng').props.onClick();f.commit();
 f.find(n=>n.type==='select'&&n.props.value==='Tổng hợp tháng').props.onChange({target:{value:'Loại biến động'}});f.commit();
 const select=f.find(n=>n.type==='select'&&n.props.value==='Nghỉ');assert.ok(select);
 assert.deepEqual(descendants(select).filter(n=>n.type==='option').map(n=>n.props.children),['Nghỉ','Đi trễ','Về sớm']);
 select.props.onChange({target:{value:'Phụ kho'}});f.commit();f.button('Tìm kiếm').props.onClick();f.commit();
 assert.equal(f.find(n=>n.props?.role==='tab'&&n.props['aria-selected']),undefined);assert.ok(f.button('Ghi nhận chấm công'));
});
test('changing manager to HR immediately clamps active tab and removes production inputs before effects',()=>{
 const f=schedule(MANAGER);f.commit();f.button('Chuyển Line').props.onClick();f.commit();
 f.find(n=>String(n.type).includes('capacity-employee-picker')).props.onChange(['TEST-NV']);f.commit();
 f.change(HR,false);assert.deepEqual(tabNames(f),[]);assert.ok(f.button('Ghi nhận chấm công'));
 assert.equal(f.nodes().some(n=>n.props?.['aria-label']==='Line nguồn chuyển người'),false);
 assert.equal(f.find(n=>n.type==='form'),undefined);assert.equal(f.saves.length,0,'stale transfer cannot submit under HR permissions');
 f.commit();assert.equal(f.find(n=>String(n.type).includes('capacity-employee-picker')),undefined);
});
test('edit and cancel dialogs disappear when role no longer permits the original record',()=>{
 for(const cancelOnly of [false,true])for(const restricted of [{...entry,absenceType:'Phụ kho'},{...entry,kind:'line-movement',destinationLine:'B'}]){
 const f=fixture('actual-labor-edit.tsx',{entry:restricted,employees:[],cancelOnly,busy:false,close(){},...MANAGER});f.commit();assert.ok(f.render());f.change(HR,false);assert.equal(f.render(),null);assert.equal(f.saves.length,0);
 }
});
test('HR edit type options exclude warehouse; non-HR and combined options are preserved',()=>{
 for(const rights of [HR,MANAGER,ADMIN]){const f=fixture('actual-labor-edit.tsx',{entry:{...entry,absenceType:rights.hr?'Nghỉ':'Phụ kho'},employees:[],busy:false,close(){},...rights});f.commit();const select=f.find(n=>n.type==='select'&&n.props.value===(rights.hr?'Nghỉ':'Phụ kho'));assert.deepEqual(descendants(select).filter(n=>n.type==='option').map(n=>n.props.children),controls.attendanceInputTypes(rights).filter(v=>v!=='Chuyển Line'));}
});
test('monthly HR history preserves old warehouse/transfer records without edit or cancel actions',()=>{
 const events=[entry,{...entry,id:'TEST-WAREHOUSE',absenceType:'Phụ kho'},{...entry,id:'TEST-TRANSFER',kind:'line-movement',destinationLine:'B'}];
 const f=fixture('actual-labor-month.tsx',{events,employees:[],line:'A',locked:false,initialMonth:'2026-10',busy:false,...HR});f.commit();
 assert.equal(f.nodes().filter(n=>n.type==='tr').length,4);assert.equal(f.nodes().filter(n=>n.type==='button'&&n.props.children==='Sửa').length,1);
 assert.equal(f.nodes().filter(n=>n.type==='button'&&n.props.children==='Hủy bản ghi').length,1);
});
test('pure guards reject unsupported selections and preserve role behavior',()=>{
 assert.equal(controls.attendanceInputType('Phụ kho',HR),'Nghỉ');assert.equal(controls.attendanceInputType('Nghỉ',MANAGER),'Phụ kho');assert.equal(controls.attendanceInputType('Phụ kho',{}),'');
 assert.equal(controls.canEditAttendance({...entry,cancelled:true},ADMIN),false);assert.equal(controls.canEditAttendance({...entry,kind:'transfer'},ADMIN),false);
});
test('an edit with a stale warehouse type cannot submit after combined rights narrow to HR',()=>{
 const f=fixture('actual-labor-edit.tsx',{entry,employees:[],busy:false,close(){},...ADMIN});f.commit();
 f.find(n=>n.type==='select'&&n.props.value==='Nghỉ').props.onChange({target:{value:'Phụ kho'}});f.commit();
 f.change(HR,false);f.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(f.saves.length,0);
 assert.equal(f.button('Lưu điều chỉnh').props.disabled,true);
});
test('warehouse correction closes immediately when manager permission is removed',()=>{
 const f=schedule(MANAGER);f.change({events:[{...entry,absenceType:'Phụ kho'}]});f.commit();f.button('Điều chỉnh giờ').props.onClick();f.commit();
 assert.ok(f.find(n=>n.type==='form'&&n.props['aria-label']==='Điều chỉnh có mặt thực tế'));
 f.change(HR,false);assert.equal(f.find(n=>n.type==='form'&&n.props['aria-label']==='Điều chỉnh có mặt thực tế'),undefined);
});
test('only haquyen keeps HR attendance inputs even with combined management grants',()=>{
 for(const login of ['haquyen',' HAQUYEN ']){
  const original={...ADMIN,confirm:true,line:null},ui=controls.attendanceUiRights(login,original);
  assert.equal(ui.manager,false);assert.equal(ui.hr,true);assert.equal(ui.confirm,true);assert.equal(original.manager,true,'never mutate actual grants');
  const f=schedule({...original,attendanceManager:ui.manager});f.commit();
  assert.deepEqual(tabNames(f),[]);assert.ok(f.button('Ghi nhận chấm công'));assert.ok(f.button('Lưu thay đổi'),'unrelated schedule manager capability is preserved');
  for(const absenceType of ['Phụ kho','Chuyển Line'])assert.equal(controls.attendanceInputTypes(ui).includes(absenceType),false);
 }
 for(const login of ['cnphuong','other.manager','admin','haquyen2','Hà Ái Quyên',undefined])assert.equal(controls.attendanceUiRights(login,ADMIN).manager,true);
 assert.equal(controls.attendanceUiRights('haquyen',{hr:false,manager:false}).hr,false,'UI profile cannot grant HR permission');
});
test('switching from another combined manager to haquyen clamps stale transfer and keeps schedule permission',()=>{
 const f=schedule({...ADMIN,attendanceManager:true});f.commit();f.button('Chuyển Line').props.onClick();f.commit();
 f.find(n=>String(n.type).includes('capacity-employee-picker')).props.onChange(['TEST-NV']);f.commit();
 f.change({attendanceManager:controls.attendanceUiRights('haquyen',ADMIN).manager},false);
 assert.deepEqual(tabNames(f),[]);assert.ok(f.button('Ghi nhận chấm công'));assert.ok(f.button('Lưu thay đổi'));
 assert.equal(f.find(n=>n.type==='form'),undefined);assert.equal(f.saves.length,0);
 f.commit();assert.equal(f.find(n=>String(n.type).includes('capacity-employee-picker')),undefined);
});
test('profile is wired from authenticated session login, and only attendance receives narrowed manager state',()=>{
 const page=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const prod=fs.readFileSync(new URL('../components/production-management.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let loginProp,forwardProp;
 function visit(node){if(ts.isJsxSelfClosingElement(node)&&['ProductionContent','ProductionManagement'].includes(node.tagName.getText(ast))){const attr=node.attributes.properties.find(a=>a.name?.getText(ast)==='preferenceUser');if(attr){if(node.tagName.getText(ast)==='ProductionContent')loginProp=attr.initializer.expression.getText(ast);else forwardProp=attr.initializer.expression.getText(ast);}}ts.forEachChild(node,visit);}visit(ast);
 assert.equal(loginProp,'session?.login');assert.equal(forwardProp,'preferenceUser');
 assert.match(prod,/attendanceUiRights\(preferenceUser,data.rights\)/);
 assert.match(prod,/manager=\{data.rights.manager&&actualScheduleAllowed\} attendanceManager=\{attendanceRights.manager&&actualScheduleAllowed\}/);
});

test('cnphuong preserves warehouse and transfer inputs with existing combined rights',()=>{
 const rights=controls.attendanceUiRights('cnphuong',ADMIN);
 assert.equal(rights.manager,true);assert.equal(rights.hr,true);
 const f=schedule({...ADMIN,attendanceManager:rights.manager});f.commit();
 assert.deepEqual(tabNames(f),['Phụ kho','Chuyển Line']);assert.ok(f.button('Ghi nhận chấm công'));
 f.button('Phụ kho').props.onClick();f.commit();assert.equal(f.find(n=>n.props?.role==='tab'&&n.props['aria-selected']).props.children,'Phụ kho');
 f.button('Chuyển Line').props.onClick();f.commit();assert.ok(f.find(n=>n.props?.['aria-label']==='Line nguồn chuyển người'));
 assert.equal(controls.canEditAttendance({...entry,absenceType:'Phụ kho'},rights),true);
 assert.equal(controls.canEditAttendance({...entry,kind:'line-movement'},rights),true);
});
test('attendance creation omits free-text reason and saves the selected type in history payload',()=>{
 for(const type of ['Chuyển Line']){
  const f=schedule(ADMIN);f.commit();f.button(type).props.onClick();f.commit();
  const form=f.find(n=>n.type==='form'&&n.props.className==='actual-line-leave');
  assert.equal(descendants(form).some(n=>n.type==='input'&&n.props.placeholder==='Ghi chú nghỉ / đi trễ / về sớm'),false);
  assert.equal(descendants(form).some(n=>n.type==='label'&&[n.props.children].flat().includes('Lý do')),false);
  if(type==='Chuyển Line'){f.change({employees:[{id:'TEST-NV',name:'Test',line:'C'}],events:[]});f.find(n=>n.props?.['aria-label']==='Line nguồn chuyển người').props.onChange({target:{value:'C'}});f.commit();}
  f.find(n=>String(n.type).includes('capacity-employee-picker')).props.onChange(['TEST-NV']);f.commit();
  f.find(n=>n.type==='form'&&n.props.className==='actual-line-leave').props.onSubmit({preventDefault(){}});
  assert.equal(f.saves.length,1);assert.equal(f.saves[0].reason,type);
  assert.equal(f.saves[0].action,type==='Chuyển Line'?'line-movement':'line-absence');
  if(type!=='Chuyển Line')assert.equal(f.saves[0].absenceType,type);
  assert.ok(f.find(n=>n.type==='input'&&n.props.id==='actual-reason'),'schedule audit reason remains');
 }
 const f=fixture('actual-labor-edit.tsx',{entry,employees:[],busy:false,close(){},...ADMIN});f.commit();
 assert.ok(f.find(n=>n.type==='label'&&[n.props.children].flat().includes('Lý do')),'edit audit reason remains');
});
test('new transfers only select source-Line employees and require a bounded end without either checkbox',()=>{
 const employees=[{id:'TEST-A',name:'A',line:'A'},{id:'TEST-C',name:'C',line:'C'},{id:'TEST-D',name:'D',line:'D'},{id:'TEST-INACTIVE',line:'C',active:false}];
 const f=schedule(MANAGER);f.change({employees});f.commit();f.button('Chuyển Line').props.onClick();f.commit();
 f.find(n=>n.props?.['aria-label']==='Line nguồn chuyển người').props.onChange({target:{value:'C'}});f.commit();
 const picker=()=>f.find(n=>String(n.type).includes('capacity-employee-picker'));
 assert.deepEqual(Array.from(picker().props.employees,e=>e.id),['TEST-C']);
 const form=()=>f.find(n=>n.type==='form'&&n.props.className==='actual-line-leave');
 assert.equal(descendants(form()).some(n=>n.type==='input'&&n.props.type==='checkbox'),false);
 assert.ok(f.find(n=>n.props?.['aria-label']==='Đến giờ 24h'));
 assert.ok(f.find(n=>n.type==='label'&&[n.props.children].flat().includes('Đến ngày')));
 picker().props.onChange(['TEST-C']);f.commit();form().props.onSubmit({preventDefault(){}});
 assert.equal(f.saves[0].directoryAssignment,undefined);assert.ok(f.saves[0].endsAt);assert.ok(Date.parse(f.saves[0].endsAt)>Date.parse(f.saves[0].effectiveAt));assert.equal(f.saves[0].reason,'Chuyển Line');
 f.find(n=>n.props?.['aria-label']==='Line nguồn chuyển người').props.onChange({target:{value:'D'}});f.commit();
 assert.deepEqual(Array.from(picker().props.employees,e=>e.id),['TEST-D']);assert.equal(picker().props.selected.length,0);
});
test('existing permanent-transfer history and its correction controls remain available to managers',()=>{
 const old={...entry,kind:'line-movement',line:'C',destinationLine:'A',endsAt:null,directoryAssignment:true};
 const f=fixture('actual-labor-edit.tsx',{entry:old,employees:[],busy:false,close(){},...MANAGER});f.commit();
 assert.ok(f.find(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.checked===true));
 const month=fixture('actual-labor-month.tsx',{events:[old],employees:[],line:'A',locked:false,initialMonth:'2026-10',busy:false,...MANAGER});month.commit();
 assert.ok(month.button('Sửa'));assert.ok(month.button('Hủy bản ghi'));
});

test('actual transfer selector includes inbound borrowers and rejects stale selection after interval change',()=>{
 const date='2026-10-12',employees=[...Array.from({length:10},(_,i)=>({id:`B${i}`,name:`B${i}`,line:'B'})),{id:'C1',name:'C1',line:'C'},{id:'C2',name:'C2',line:'C'}];
 const events=[{id:'loan',kind:'line-movement',line:'C',destinationLine:'B',employees:['C1','C2'],effectiveAt:`${date}T08:00:00+07:00`,endsAt:`${date}T17:00:00+07:00`}];
 const f=schedule(MANAGER);f.change({employees,events});f.button('Chuyển Line').props.onClick();f.commit();
 f.find(n=>n.props?.['aria-label']==='Line nguồn chuyển người').props.onChange({target:{value:'B'}});f.commit();
 descendants(f.find(n=>n.type==='form'&&n.props.className==='actual-line-leave')).find(n=>n.type==='input'&&n.props.type==='date'&&!n.props.min).props.onChange({target:{value:date}});f.commit();
 const picker=()=>f.find(n=>String(n.type).includes('capacity-employee-picker'));
 assert.equal(picker().props.employees.length,12);
 picker().props.onChange(['C1']);f.commit();
 f.find(n=>n.props?.['aria-label']==='Đến giờ 24h').props.onChange({target:{value:'18:00'}});f.commit();
 assert.equal(picker().props.employees.length,10);assert.equal(picker().props.selected.length,0);
 picker().props.onChange(['C1']);f.commit();
 f.find(n=>n.type==='form'&&n.props.className==='actual-line-leave').props.onSubmit({preventDefault(){}});assert.equal(f.saves.length,0);
});
test('schedule provisional range does not become a numeric cleaning limit or change action employee directory',()=>{
 const date='2026-10-19',people=[{id:'TEST-NV',name:'Test',line:'A'},{id:'TEST-NV2',name:'Other',line:'A'}],day={date,working:true,hcStart:'09:00',hcEnd:'17:00',cleaning:[{people:1,start:'16:00',end:'17:00'}]};
 const f=schedule(ADMIN);f.change({week:date,days:[day],events:[],employees:people,approved:{workers:2,roster:[{date,hc:people.map(p=>p.id),ot:[]}],input:{dailySchedule:[day],dailyHcLeave:[{date,mode:'hours',start:'09:00',end:'10:00',employees:['TEST-NV']}]}}});
 const cleaning=f.find(n=>n.type==='input'&&n.props['aria-label']==='Số người vệ sinh');assert.equal(cleaning.props.max,2);assert.equal(typeof cleaning.props.max,'number');
});
