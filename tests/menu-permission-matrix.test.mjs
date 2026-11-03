import {actionFeedbackComponentFixture} from './helpers/action-feedback-fixture.mjs';
import {requestDepartment} from '../lib/department-change-access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {productionMenuRights,workflowActionAllowed} from '../lib/menu-action-access.mjs';
import {permissionProfiles,profileForUser,quickLinePermissions} from '../lib/user-permission-profiles.mjs';
const source=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=new Set(['normalizedGrant','moduleGrantLabels','childGrantLabels','canOpenMenu','canOpenLegacyMenu','hasAllocationCapability','AppSidebar','ModuleOverview','moduleOverviewSteps']);
const selected=ast.statements.filter(s=>names.has(s.name?.text)||s.declarationList?.declarations.some(d=>names.has(d.name?.text))).map(s=>s.getText(ast)).join('\n');
const compiled=ts.transpileModule(selected+'\nexports.check=canOpenMenu;exports.Sidebar=AppSidebar;exports.Overview=ModuleOverview;',{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(compiled,{exports,...actionFeedbackComponentFixture,requestDepartment,require:()=>jsxRuntime,useState:()=>[false,()=>{}],useEffect:()=>{},UiLabel:({children})=>children,PageTitle:({children})=>React.createElement('h1',null,children),translateToolbar:s=>s,toolbarLocale:()=> 'vi'});
const cases=[...Object.entries(permissionProfiles).map(([name,p])=>({name,kind:'account',grants:p.grants})),{name:'ADMIN',kind:'account',isAdmin:true,grants:[]},{name:'SUPER_ADMIN',kind:'account',isAdmin:true,grants:[]},...['A','B'].map(line=>({name:`LINE_${line}`,line,login:`LINE_${line}`,authMode:'quick_line',...profileForUser({login:`LINE_${line}`,line,authMode:'quick_line',role:'USER'})})),{name:'CUSTOM_EMPLOYEES',kind:'account',grants:['Dữ liệu cơ bản / Danh sách nhân viên / Xem']},{name:'NO_GRANTS',kind:'account',grants:[]},{name:'ALLOCATION_ONLY',kind:'account',grants:[],allocationGroup:'C'}];
const expected={HR:['Lịch sản xuất thực tế'],KHSX:['Tiến độ sản xuất'],QLSX:['SX báo công','Lịch sản xuất thực tế','Tiến độ sản xuất','Nhật ký báo công','Điều chỉnh báo công','Sản lượng và giờ công','Hiệu suất và tiền sản lượng'],SX:['SX báo công'],KHO:[],QC:[],LINE_A:['SX báo công','Lịch sản xuất thực tế','Tiến độ sản xuất','Nhật ký báo công','Điều chỉnh báo công','Sản lượng và giờ công','Hiệu suất và tiền sản lượng'],LINE_B:['SX báo công','Lịch sản xuất thực tế','Tiến độ sản xuất','Nhật ký báo công','Điều chỉnh báo công','Sản lượng và giờ công','Hiệu suất và tiền sản lượng'],CUSTOM_EMPLOYEES:[],NO_GRANTS:[],ALLOCATION_ONLY:[]};
const labels=expected.QLSX;
for(const session of cases)test(`menu visibility: ${session.name}`,()=>{
 if(session.kind==='line'){assert.equal(session.isAdmin,undefined);assert.deepEqual(session.grants,quickLinePermissions);assert.deepEqual(session.grants.filter(g=>!g.endsWith('/ Xem')),['Quản lý sản xuất / Báo công sản xuất / Thêm','Quản lý sản xuất / Báo công sản xuất / Lưu']);assert.deepEqual(productionMenuRights(session),{work:true,manager:false,confirm:false,correct:false});for(const action of ['schedule','warehouse-duty','line-movement','approve-hours','recalculate-attendance-hours'])assert.equal(workflowActionAllowed(session,{action}),false,action);}
 const canOpen=(view,child)=>exports.check(session,view,child);
 if(session.kind==='line')for(const view of ['users','sku','warehouse','bom','planning'])assert.equal(canOpen(view),false,view);
 if(session.name==='ALLOCATION_ONLY'){assert.equal(canOpen('production','capacity-calendar'),true);assert.equal(canOpen('production','capacity-summary'),false);}
 const allowedViews=new Set(['users','sku','warehouse','bom','planning','production'].filter(v=>canOpen(v)));
 const html=renderToStaticMarkup(React.createElement(exports.Sidebar,{view:'production',child:null,collapsed:false,canOpen,allowedViews,isAdmin:!!session.isAdmin,sessionLine:session.line,productionReportExpanded:true,capacityExpanded:true,scopeId:'test',language:'vi'}));
 for(const label of labels)assert.equal(html.includes(label),session.isAdmin||expected[session.name].includes(label),`${session.name}: ${label}`);
 if(canOpen('production')){
  const overview=renderToStaticMarkup(React.createElement(exports.Overview,{view:'production',canOpen,sessionLine:session.line,onOpen:()=>{}}));
  if(session.name==='HR')assert.doesNotMatch(overview,/SX báo công|Điều chỉnh báo công|Hiệu suất/);
 }
});
