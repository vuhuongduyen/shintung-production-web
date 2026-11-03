import {hasMenuPermission} from '../lib/menu-action-access.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {legacyCapacityPolicyFixture as baseline} from './fixtures/legacy-capacity-policy.mjs';
import ts from 'typescript';
import {createBackgroundRefresh} from '../lib/client-background-refresh.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
import {capacityPermissions,mutateCapacity} from '../scripts/local/capacity.mjs';
import {permissionProfiles} from '../lib/user-permission-profiles.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';
const feedbackModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/permission-feedback.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:feedbackModule,exports:feedbackModule.exports});
function provider(source,session){let arrow;const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n){if(ts.isArrowFunction(n)&&n.getText(ast).includes('if(name === "FeedbackInbox")'))arrow=n.getText(ast);else ts.forEachChild(n,visit);}visit(ast);assert.ok(arrow);const js=ts.transpileModule('module.exports='+arrow,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const ctx={module:{exports:{}},session,hasMenuPermission,...feedbackModule.exports,view:'production',activeChild:'weekly-capacity',childGrantLabels:{'production:weekly-capacity':'Quản lý sản xuất / Capacity tuần'},normalizedGrant:v=>String(v).toLowerCase().replaceAll('_',' ').replace(/\s+/g,' ').trim()};vm.runInNewContext(js,ctx);return ctx.module.exports;}
const current=fs.readFileSync('app/page.tsx','utf8');
test('production actions require grants for their own menu',()=>{
 const gate=provider(current,{...{login:'TEST',grants:['Quản lý sản xuất / Capacity tuần / Sửa','Quản lý sản xuất / Capacity tuần / Xác nhận']},kind:'account'});
 assert.equal(gate('ActualWorkSchedule','Lưu thay đổi'),false);
 assert.equal(gate('ProductionProgressReview','Xác nhận báo công (1)'),false);
 const review=provider(current,{login:'TEST',kind:'account',grants:['Quản lý sản xuất / Tiến độ sản xuất / Xác nhận']});
 assert.equal(review('ProductionProgressReview','Xác nhận báo công (1)'),true);
 assert.equal(review('ActualWorkSchedule','Lưu thay đổi'),false);
 const edit=provider(current,{login:'TEST',kind:'account',grants:['Quản lý sản xuất / Tiến độ sản xuất / Sửa']});
 assert.equal(edit('ProductionProgressReview','Xác nhận báo công (1)'),false);
 assert.equal(edit('ProductionProgressReview','Ẩn đã xác nhận báo công'),true);
});
const actors={QLSX:{login:'TEST-QLSX',grants:permissionProfiles.QLSX.grants},KHSX:{login:'TEST-KHSX',grants:permissionProfiles.KHSX.grants},confirmOnly:{login:'TEST-C',grants:['Quản lý sản xuất / Capacity tuần / Xem','Quản lý sản xuất / Capacity tuần / Xác nhận']},editOnly:{login:'TEST-E',grants:['Quản lý sản xuất / Capacity tuần / Xem','Quản lý sản xuất / Capacity tuần / Sửa']}};
const vite=await createServer({plugins:[{name:'capacity-permission-fixture',enforce:'pre',transform(s,id){if(!id.endsWith('/components/weekly-capacity.tsx'))return;assert.ok(s.includes("[selected,setSelected]=useState<string[]>(view==='calendar'?[sessionLine||'A']:[])"),'Capacity selected-row fixture matches component initializer');return s.replace('[permissionsReady,setPermissionsReady]=useState(false)','[permissionsReady,setPermissionsReady]=useState(true)').replace('[weekReady,setWeekReady]=useState(initial.ready)','[weekReady,setWeekReady]=useState(true)').replace('[state,setState]=useState<Item|null>(initial.snapshot?.data||null)','[state,setState]=useState<Item|null>(globalThis.__capacityFixture)').replace('[rows,setRows]=useState<Item[]>(initial.snapshot?.data.rows||[])','[rows,setRows]=useState<Item[]>(globalThis.__capacityFixture.rows)').replace("[selected,setSelected]=useState<string[]>(view==='calendar'?[sessionLine||'A']:[])","[selected,setSelected]=useState<string[]>(['A'])");}}],configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {default:Capacity}=await vite.ssrLoadModule('/components/weekly-capacity.tsx');
const {ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
function render(actor,view,status='Nháp',reviewStatus=null,useBaseline=false){const row=newDailyCapacity('2026-10-26','A');Object.assign(row,{status,reviewStatus});globalThis.__capacityFixture={revision:1,rows:[row],permissions:capacityPermissions(actor)};try{return renderToStaticMarkup(React.createElement(ToolbarPermissions.Provider,{value:provider(useBaseline?baseline:current,{...actor,kind:'account'})},React.createElement(Capacity,{view})));}finally{delete globalThis.__capacityFixture;}}
test('synthetic deny-all toolbar negative control hides capacity buttons despite granted capabilities',()=>{assert.equal(capacityPermissions(actors.QLSX).confirm,true);const html=render(actors.QLSX,'calendar','Nháp',null,true);assert.match(html,/<button[^>]*aria-disabled="true"[^>]*>Lưu nháp<\/button>/);assert.match(html,/<button[^>]*aria-disabled="true"[^>]*>Xác nhận<\/button>/);});
test('TEST global toolbar respects capacity capabilities: QLSX and confirm-only',()=>{const q=render(actors.QLSX,'calendar');assert.match(q,/>Lưu nháp</);assert.match(q,/>Xác nhận</);const c=render(actors.confirmOnly,'calendar');assert.match(c,/<button[^>]*aria-disabled="true"[^>]*>Lưu nháp<\/button>/);assert.match(c,/>Xác nhận</);const sync=render(actors.confirmOnly,'summary','Đã xác nhận','await-sync');assert.match(sync,/<button(?![^>]*disabled)[^>]*>Đồng bộ KHSX<\/button>/);});
test('KHSX and edit-only see denied feedback controls without producer capabilities',()=>{for(const actor of [actors.KHSX,actors.editOnly])assert.match(render(actor,'summary','Đã xác nhận','await-sync'),/<button[^>]*aria-disabled="true"[^>]*>Đồng bộ KHSX<\/button>/);for(const label of ['Lưu nháp','Xác nhận','Hủy xác nhận'])assert.match(render(actors.KHSX,'calendar'),new RegExp('<button[^>]*aria-disabled="true"[^>]*>'+label+'<\\/button>'));assert.equal(capacityPermissions(actors.KHSX).review,true);assert.equal(capacityPermissions(actors.QLSX).review,false);});
test('sync requires confirmed await-sync state even with permission',()=>{for(const [status,review]of [['Nháp',null],['Đã xác nhận','pending'],['Đã xác nhận','approved']])assert.match(render(actors.QLSX,'summary',status,review),/<button[^>]*disabled[^>]*>Đồng bộ KHSX<\/button>/);});
test('API denies unauthorized sync/review/save before any DB access',async()=>{const db={prepare(){throw Error('Unexpected DB access');}};for(const [actor,action]of [[actors.editOnly,'sync'],[actors.QLSX,'review'],[actors.KHSX,'save']])await assert.rejects(()=>mutateCapacity(db,{action},actor),e=>e.status===403);});
test('production toolbar aliases no longer drop valid capability-controlled actions',()=>{
 const gate=provider(current,{...actors.QLSX,kind:'account'}),old=provider(baseline,{...actors.QLSX,kind:'account'});
 for(const [name,label]of [['ActualWorkSchedule','Lưu thay đổi'],['ProductionProgressReview','Xác nhận báo công (1)']]){assert.equal(old(name,label),false);assert.equal(gate(name,label),true);}
});
test('catalog exposes existing special actions only for their matching menus',()=>{
 const ast=ts.createSourceFile('page.tsx',current,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const names=new Set(['permissionActions','permissionActionsForMenu']);let src='';function visit(n){if(ts.isVariableDeclaration(n)&&names.has(n.name.getText(ast)))src+='const '+n.getText(ast)+';';ts.forEachChild(n,visit);}visit(ast);
 const ctx={module:{exports:{}}};vm.runInNewContext(ts.transpileModule(src+'module.exports=permissionActionsForMenu;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);const actions=ctx.module.exports;
 assert.ok(actions('Quản lý sản xuất','Lịch SX thực tế').includes('Ghi vắng mặt'));assert.ok(!actions('Quản lý sản xuất','Capacity tuần').includes('Ghi vắng mặt'));
 assert.ok(actions('Quản lý sản xuất','Capacity tuần').includes('Sửa hệ số'));assert.ok(!actions('Dữ liệu cơ bản','SKU Master').includes('Sửa hệ số'));
 const rights=capacityPermissions({login:'TEST-FACTOR',grants:['Quản lý sản xuất / Capacity tuần / Sửa hệ số']});assert.equal(rights.factor,true);assert.equal(rights.edit,false);
});
test('catalog hides unsupported Capacity actions and preserves stored legacy grants on edits',()=>{
 const ast=ts.createSourceFile('page.tsx',current,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let src='',toggle;
 function visit(n){if(ts.isVariableDeclaration(n)&&['permissionActions','permissionActionsForMenu'].includes(n.name.getText(ast)))src+='const '+n.getText(ast)+';';if(ts.isFunctionDeclaration(n)&&n.name?.text==='PermissionMatrix'){function inner(x){if(ts.isVariableDeclaration(x)&&x.name.getText(ast)==='toggle')toggle=x.initializer.getText(ast);ts.forEachChild(x,inner);}inner(n);}ts.forEachChild(n,visit);}visit(ast);
 const legacy='Quản lý sản xuất / Capacity tuần / Xóa';let updated;
 const ctx={module:{exports:{}},value:[legacy,'Legacy / Unknown / Action'],onChange:v=>updated=v};
 vm.runInNewContext(ts.transpileModule(src+'module.exports={actions:permissionActionsForMenu,toggle:'+toggle+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 for(const action of ['Xóa','Hủy','Xuất dữ liệu'])assert.equal(ctx.module.exports.actions('Quản lý sản xuất','Capacity tuần').includes(action),false);
 ctx.module.exports.toggle('Quản lý sản xuất / Capacity tuần / Xác nhận',true);
 assert.ok(updated.includes(legacy));assert.ok(updated.includes('Legacy / Unknown / Action'));assert.equal(updated.length,3);
});
test('actual component manager expressions require both capability and menu permission',()=>{
 const source=fs.readFileSync('components/production-management.tsx','utf8');const ast=ts.createSourceFile('x.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const expressions={};
 function visit(n){if(ts.isJsxSelfClosingElement(n)&&['ActualWorkSchedule','ProductionProgressReview'].includes(n.tagName.getText(ast))){const attr=n.attributes.properties.find(a=>a.name?.getText(ast)==='manager');expressions[n.tagName.getText(ast)]=attr.initializer.expression.getText(ast);}ts.forEachChild(n,visit);}visit(ast);
 for(const expression of Object.values(expressions))for(const capability of [false,true])for(const grant of [false,true])assert.equal(vm.runInNewContext(expression,{data:{rights:{manager:capability,confirm:capability}},actualScheduleAllowed:grant,confirmReportAllowed:grant}),capability&&grant);
 assert.equal(Object.keys(expressions).length,2);
});
test('active session verification refreshes changed grants instead of only checking logout',async()=>{
 function effect(source){const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'){const body=n.arguments[0]?.getText(ast)||'';if(body.includes('const verify = () =>')||(body.includes('createBackgroundRefresh')&&body.includes('/api/site-session')))found=body;}ts.forEachChild(n,visit);}visit(ast);assert.ok(found);return found;}
 async function run(source){
  let session={login:'TEST',grants:[]},interval;
  const ctx={module:{exports:{}},LOCAL_TEST:false,authenticated:true,active:true,accountKey:'account:TEST',identityRef:{current:{authenticated:true,session}},workspaceIdentityKey:()=> 'account:TEST',createBackgroundRefresh,fetch:async()=>({ok:true,json:async()=>({authenticated:true,user:{login:'TEST',grants:actors.QLSX.grants}})}),restoredLoginSession:u=>u,setSession:v=>{session=typeof v==='function'?v(session):v},setAuthenticated:()=>{},receiveIdentity:value=>{session=value.session;},document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},window:{setInterval:fn=>{interval=fn;return 1},clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}};
  vm.runInNewContext(ts.transpileModule('module.exports='+effect(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);const cleanup=ctx.module.exports();await interval();await new Promise(r=>setImmediate(r));cleanup();return session;
 }
 assert.equal((await run(baseline)).grants.length,0);assert.equal((await run(current)).grants.length,actors.QLSX.grants.length);
});
