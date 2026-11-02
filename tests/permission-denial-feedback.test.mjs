import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import {canPlanAction} from '../lib/production-plan-permissions.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{}};new Function('module','exports',compile(read('lib/permission-feedback.ts')))(helper,helper.exports);
function harness(locale='vi'){
 let cursor=0,permitted=true;const slots=[],notifications=[];
 const slot=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return i;};
 const hooks={...React,useLayoutEffect:()=>{},useContext:()=>()=>permitted,useId:()=> 'test',useSyncExternalStore:()=>locale,useRef:init=>{const i=slot(()=>({current:init}));return slots[i];},useState:init=>{const i=slot(init);return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}};
 const req=name=>name.endsWith('action-feedback')?(name.includes('lib/')?{...actionFeedbackHelpers,notifyActionFailure:(message,trigger)=>notifications.push({message,trigger})}:actionFeedbackComponentFixture):name==='react'?{...hooks,default:hooks,__esModule:true}:name==='react-dom'?{flushSync:f=>f()}:name.endsWith('permission-feedback')?helper.exports:name.endsWith('translations')?{translateToolbar:s=>s,toolbarLocale:()=>locale,subscribeToolbarLocale:()=>()=>{}}:name.endsWith('FilterPanel')?{FilterPanel:'filter-panel'}:{};
 const mod={exports:{}};new Function('require','module','exports','React',compile(read('components/standard-toolbar/StandardToolbar.tsx')))(req,mod,mod.exports,React);
 const walk=(n,fn)=>{if(Array.isArray(n)){n.forEach(x=>walk(x,fn));return;}if(!React.isValidElement(n))return;fn(n);walk(n.props.children,fn);};
 const render=(items,extra={})=>{cursor=0;const tree=mod.exports.StandardToolbar({items,name:'Test',...extra});const buttons=[],alerts=[];walk(tree,n=>{if(n.type==='button')buttons.push(n);if(n.props.role==='alert')alerts.push(n.props.children);});return {buttons,alerts};};
 const click=async b=>{let prevented=0,stopped=0;b.props.onClick({currentTarget:{},preventDefault(){prevented++},stopPropagation(){stopped++}});await new Promise(r=>setImmediate(r));return {prevented,stopped};};
 return {render,click,notifications,toolbar:mod.exports.toolbar,permission:value=>{permitted=value;}};
}
test('default denied submit action reports and blocks callback/default submission',async()=>{
 const h=harness();let calls=0;const items=[h.toolbar.action({type:'submit',onClick:()=>calls++,disabled:true},'Lưu',false)];
 assert.equal(h.render(items,{permissionFeedback:false}).buttons.length,0);
 const b=h.render(items).buttons[0];assert.equal(b.props.type,'button');assert.equal(b.props['aria-disabled'],true);assert.ok(!b.props.disabled);
 assert.deepEqual(await h.click(b),{prevented:1,stopped:1});assert.equal(calls,0);assert.deepEqual(h.notifications.map(n=>n.message),['Bạn không có quyền thực hiện thao tác này.']);assert.deepEqual(h.render(items).alerts,[]);
});
test('default denied actions notify in every locale; explicit opt-out remains hidden',async()=>{
 for(const locale of ['vi','zh','en']){
  const h=harness(locale);let mutations=0;const items=[h.toolbar.action({onClick:()=>mutations++},'Lưu',false)];
  assert.equal(h.render(items,{permissionFeedback:false}).buttons.length,0);
  const ui=h.render(items);assert.equal(ui.buttons.length,1);assert.equal(h.notifications.length,0,'rendering never emits a warning');
  await h.click(ui.buttons[0]);assert.equal(mutations,0);
  assert.deepEqual(h.notifications.map(n=>n.message),[helper.exports.permissionDeniedMessage(locale)]);
  assert.deepEqual(h.render(items).alerts,[],'global host owns the notification');
 }
});
test('permission is rechecked at click time and denied export emits no event',async()=>{
 const h=harness();let called=0;const items=[h.toolbar.action({onClick:()=>called++},'Xuất Excel')];const b=h.render(items,{permissionFeedback:true}).buttons[0];h.permission(false);
 // No global window is installed: any export dispatch would throw and fail this test.
 assert.deepEqual(await h.click(b),{prevented:1,stopped:1});assert.equal(called,0);
});
test('allowed callback executes once and business-disabled callback stays blocked',async()=>{
 const h=harness();let calls=0;const items=[h.toolbar.action({onClick:()=>calls++},'Thêm')];await h.click(h.render(items,{permissionFeedback:true}).buttons[0]);assert.equal(calls,1);
 const disabled=[h.toolbar.action({onClick:()=>calls++,disabled:true},'Sửa')];const b=h.render(disabled,{permissionFeedback:true}).buttons[0];assert.equal(b.props.disabled,true);await h.click(b);assert.equal(calls,1);assert.deepEqual(h.notifications.map(n=>n.message),[actionFeedbackHelpers.actionFeedbackMessage('unavailable')]);assert.deepEqual(h.render(disabled).alerts,[]);
});
test('denied search does not apply draft field changes',async()=>{
 const h=harness();let search=0;const items=[h.toolbar.field('Tra theo',[h.toolbar.input({value:'',onChange:()=>{throw Error('draft applied');}})]),h.toolbar.action({onClick:()=>search++},'Tìm kiếm',false,'search')];
 const b=h.render(items,{permissionFeedback:true}).buttons.find(b=>b.props.children==='Tìm kiếm');await h.click(b);assert.equal(search,0);
});
test('blocked detail Back never invokes the allowed parent Back',async()=>{
 const h=harness();let calls=0;const items=[h.toolbar.action({onClick:()=>calls++},'Quay lại',true,'back','parent'),h.toolbar.action({onClick:()=>calls++},'Quay lại',false,'back','detail')];const b=h.render(items,{permissionFeedback:true}).buttons;assert.equal(b.length,1);await h.click(b[0]);assert.equal(calls,0);
});
test('all three locales have explicit permission text',()=>{
 for(const locale of ['vi','zh','en'])assert.ok(helper.exports.permissionDeniedMessage(locale).length>10);
 assert.equal(new Set(['vi','zh','en'].map(helper.exports.permissionDeniedMessage)).size,3);
});
test('QLSX entry points guard before network or editor mutation',()=>{
 const management=read('components/production-management.tsx');
 assert.match(management,/const openWorkAction=.*if\(!canMutateProduction\|\|\(sessionLine&&row\.line!==sessionLine\)\).*denyProduction\(\);return;.*requestToken/);
 assert.match(management,/const ask=async.*if\(!canMutateProduction&&!hrAction\).*return false;.*fetch\(/);
 assert.match(management,/async function review.*if\(!data.rights.confirm\|\|!confirmReportAllowed\).*return false;.*fetch\(/);
 const correction=read('components/production-corrections.tsx');assert.match(correction,/const request=async\(apply=false\)=>\{if\(!allowed\)/);
 const progress=read('components/production-progress-review.tsx');assert.match(progress,/if\(!manager\)\{setPermissionError\(permissionDeniedMessage\(locale\)\);return;\}void onReview/);
});
function declared(source,name){const ast=ts.createSourceFile('module.tsx',source,99,true,4);let expression;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)expression=n.initializer.getText(ast);if(ts.isFunctionDeclaration(n)&&n.name?.text===name)expression=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(expression,name);return expression;}
function executable(expression,scope){const mod={exports:{}};new Function(...Object.keys(scope),'module',compile('module.exports=('+expression+');'))(...Object.values(scope),mod);return mod.exports;}
test('real production handler bodies deny view-only calls before fetch, editor state or form parsing',async()=>{
 const source=read('components/production-management.tsx');let denied=0,network=0,mutations=0;
 const scope={canMutateProduction:false,data:{rights:{manager:false,confirm:false,hr:false}},confirmReportAllowed:false,denyProduction:()=>denied++,fetch:()=>{network++;throw Error('network');},setBusy:()=>mutations++};
 assert.equal(await executable(declared(source,'ask'),scope)({action:'start'}),false);
 assert.equal(await executable(declared(source,'review'),scope)({},true),false);
 executable(declared(source,'openWorkAction'),scope)({},'start');
 let prevented=0;executable(declared(source,'saveAction'),scope)({preventDefault(){prevented++},get currentTarget(){throw Error('form read');}});
 assert.equal(prevented,1);assert.equal(denied,4);assert.equal(network,0);assert.equal(mutations,0);
});
test('real correction handlers deny editor and preview/apply before state changes or API calls',async()=>{
 const source=read('components/production-corrections.tsx');let alerts=0,network=0;
 const scope={allowed:false,setMessage:m=>{assert.equal(m.kind,'error');alerts++;},permissionDeniedMessage:helper.exports.permissionDeniedMessage,locale:'vi',productionApiFetch:()=>{network++;},setSelected:()=>{throw Error('editor changed');}};
 executable(declared(source,'begin'),scope)({});
 await executable(declared(source,'request'),scope)(false);await executable(declared(source,'request'),scope)(true);
 assert.equal(alerts,3);assert.equal(network,0);
});
test('export classification distinguishes data export from work and ordinary refresh',()=>{
 for(const label of ['Xuất Excel','Xuất PDF','Xuất dữ liệu','Tải Excel','Tải PDF','Export Excel','Download PDF','匯出 Excel'])assert.equal(helper.exports.isDataExportAction(label),true,label);
 for(const label of ['Xuất trạm','Cập nhật dữ liệu','Tải lại dữ liệu','Tra cứu','Tải file Forecast PDF','↑ Tải Excel tồn kho','Tải Excel tồn kho','Upload Excel'])assert.equal(helper.exports.isDataExportAction(label),false,label);
});
function workspacePermission(session){
 const source=read('app/page.tsx'),ast=ts.createSourceFile('page.tsx',source,99,true,4);let expression;
 function visit(node){if(ts.isJsxOpeningElement(node)&&node.tagName.getText(ast)==='ToolbarPermissions.Provider'){const value=node.attributes.properties.find(item=>item.name?.getText(ast)==='value');expression=value.initializer.expression.getText(ast);}ts.forEachChild(node,visit);}visit(ast);assert.ok(expression);
 return executable(expression,{session,canPlanAction,normalizedGrant:executable(declared(source,'normalizedGrant'),{}),isDataExportAction:helper.exports.isDataExportAction,hasExactExportGrant:helper.exports.hasExactExportGrant,childGrantLabels:{'warehouse:inventory':'Quản lý kho / Tồn kho ERP'},view:'warehouse',activeChild:'inventory'});
}
test('actual workspace provider preserves inventory import without granting export',()=>{
 const canUse=workspacePermission({kind:'account',grants:['Quản lý kho / Tồn kho ERP / Thêm']});
 assert.equal(canUse('WarehouseContent','↑ Tải Excel tồn kho'),true);
 assert.equal(canUse('WarehouseContent','Xuất Excel'),false);
});
test('actual production guard preserves Lưu-only, line, and manager access while denying view-only and HR work',async()=>{
 const expression=declared(read('components/production-management.tsx'),'canMutateProduction');
 for(const [session,manager,expected] of [
  [{kind:'account',grants:['Quản lý sản xuất / Báo công sản xuất / Lưu']},false,true],
  [{kind:'account',grants:['Quản lý sản xuất / Báo công sản xuất / Sửa']},false,true],
  [{kind:'account',grants:['Quản lý sản xuất / Báo công sản xuất / Xem']},false,false],
  [{kind:'account',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']},false,false],
  [{kind:'line'},false,true],
  [{kind:'account',grants:[]},true,true],
 ])assert.equal(executable(expression,{data:{rights:{manager}},canUseProduction:workspacePermission(session)}),expected);
 let network=0;const ask=executable(declared(read('components/production-management.tsx'),'ask'),{canMutateProduction:false,data:{rights:{hr:true}},denyProduction:()=>{throw Error('HR incorrectly denied');},setBusy:()=>{},setMessage:()=>{},fetch:async()=>{network++;throw Error('synthetic endpoint');}});
 for(const action of ['line-absence','attendance-override','attendance-correction','attendance-cancel','attendance-edit'])await ask({action});
 assert.equal(network,5);
});
test('export requires exact menu grant, not view/edit or another menu export',()=>{
 const menu='Quản lý sản xuất / Sản lượng và giờ công';const actor={kind:'account',grants:[menu+' / Xem',menu+' / Sửa','Quản lý sản xuất / Nhật ký / Xuất dữ liệu']};
 assert.equal(helper.exports.hasExactExportGrant(actor,menu),false);actor.grants.push(menu+' / Xuất dữ liệu');assert.equal(helper.exports.hasExactExportGrant(actor,menu),true);
 assert.equal(helper.exports.hasExactExportGrant({kind:'line',isAdmin:true},menu),false);assert.equal(helper.exports.hasExactExportGrant({kind:'account',isAdmin:true},menu),true);
});
test('custom Capacity and preview downloads deny before Blob, DOM or network work',async()=>{
 let notices=0;const notify=()=>notices++;
 const scope={exportAllowed:false,setError:notify,setExportMessage:notify,permissionDeniedMessage:helper.exports.permissionDeniedMessage,toolbarLocale:()=> 'vi',locale:'vi'};
 executable(declared(read('components/weekly-capacity.tsx'),'exportFile'),scope)();
 await executable(declared(read('components/report-preview.tsx'),'download'),scope)('xlsx');
 await executable(declared(read('components/report-preview.tsx'),'download'),scope)('pdf');
 await executable(declared(read('components/production-payroll.tsx'),'exportReport'),scope)('xlsx');
 assert.equal(notices,4);
});
test('generic export handler cancels denied event before reading table or running fallback',()=>{
 const source=read('components/table-reports.tsx');let denied=0,cancelled=0;
 const root={contains:()=>true},button={closest(){throw Error('table read');}};
 const handler=executable(declared(source,'handler'),{scopeId:'test',allowed:false,document:{getElementById:()=>root},setDenial:()=>denied++,permissionDeniedMessage:helper.exports.permissionDeniedMessage,toolbarLocale:()=> 'vi'});
 handler({detail:{button},preventDefault(){cancelled++;}});assert.equal(denied,1);assert.equal(cancelled,1);
});
test('existing unlisted grants stay checked by default, exact removal is draft-only, known matrix excluded',()=>{
 const mod={exports:{}};new Function('require','module','exports','React',compile(read('components/existing-permission-grants.tsx')))(()=>({}),mod,mod.exports,React);
 const legacy=['Hệ thống người dùng / Quản lý người dùng / Xem','Hệ thống người dùng / Phân quyền / Xem'],known=['Dữ liệu cơ bản / Leadtime / Xem'],persisted=[...known,...legacy];let draft=persisted;const updates=[];
 const tree=mod.exports.default({existing:persisted,known,value:draft,onChange:next=>{draft=next;updates.push(next);}});const inputs=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return;}if(!React.isValidElement(n))return;if(n.type==='input')inputs.push(n);walk(n.props.children);}walk(tree);
 assert.equal(updates.length,0);assert.equal(inputs.length,2);assert.ok(inputs.every(n=>n.props.checked));
 inputs[0].props.onChange({target:{checked:false}});assert.deepEqual(draft,[...known,legacy[1]]);assert.deepEqual(persisted,[...known,...legacy]);
 // Cancel discards the parent draft: reopening from the persisted record restores both checks.
 const reopened=mod.exports.default({existing:persisted,known,value:persisted,onChange:()=>{throw Error('unexpected change');}});assert.ok(reopened);
 assert.equal(mod.exports.default({existing:known,known,value:known,onChange:()=>{}}),null);
 const disabled=mod.exports.default({existing:persisted,known,value:persisted,onChange:()=>{},disabled:true});assert.equal(disabled.props.disabled,true);
});
test('authorized generic preview and custom download retain their original flow',async()=>{
 let previews=0,cancelled=0,downloads=0,objects=0;const main={},button={closest:()=>main};
 const handler=executable(declared(read('components/table-reports.tsx'),'handler'),{scopeId:'test',allowed:true,document:{getElementById:()=>({contains:()=>true})},preview:value=>{assert.equal(value,main);previews++;return true;}});
 handler({detail:{button},preventDefault(){cancelled++;}});assert.equal(previews,1);assert.equal(cancelled,1);
 const scope={exportAllowed:true,busy:false,setBusy:()=>{},setError:()=>{},report:{title:'TEST'},payrollXlsx:()=>new Uint8Array([1,2]),payrollPdf:async()=>new Uint8Array([3]),Blob,URL:{createObjectURL(){objects++;return 'blob:test';},revokeObjectURL(){}},document:{createElement:()=>({click(){downloads++;}})},setTimeout:()=>{}};
 const download=executable(declared(read('components/report-preview.tsx'),'download'),scope);await download('xlsx');await download('pdf');assert.equal(downloads,2);assert.equal(objects,2);
});


test('actual ProPlan toolbar uses exact close/reopen grants and preserves the legacy reopen alias',()=>{
 for(const [grant,close,reopen] of [['Xem',false,false],['Sửa',false,false],['Xác nhận',true,false],['Hủy xác nhận',false,true],['Mở lại',false,true]]){
  const canUse=workspacePermission({kind:'account',login:'TEST',grants:[`Kế hoạch sản xuất / Production_plan / ${grant}`]});
  assert.equal(canUse('ProductionPlan','Chốt kế hoạch'),close,grant);
  assert.equal(canUse('ProductionPlan','Mở chốt'),reopen,grant);
 }
 assert.equal(workspacePermission({kind:'line',login:'TEST',grants:['Kế hoạch sản xuất / Production_plan / Hủy xác nhận']})('ProductionPlan','Mở chốt'),false);
 assert.equal(workspacePermission({kind:'account',login:'TEST',grants:['Kế hoạch sản xuất / In_transit / Hủy xác nhận']})('ProductionPlan','Mở chốt'),false);
});
