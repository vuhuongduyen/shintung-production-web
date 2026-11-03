import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {readFileSync} from 'node:fs';
import {clientAuthorizationKey} from '../lib/client-authorization-context.mjs';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=name=>ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name||ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)===name)).getText(ast);
const names=['restoredLoginSession','normalizedGrant','moduleGrantLabels','childGrantLabels','canOpenLegacyMenu','hasAllocationCapability','canOpenMenu','allocationOnlySchedule','ProductionContent'];
const ctx={React,ProductionManagement:()=>null,WeeklyCapacity:()=>null,ProductionAllocationWorkspace:()=>null,PageTitle:()=>null};
vm.runInNewContext(ts.transpileModule(names.map(declaration).join('\n')+'\nObject.assign(globalThis,{restoredLoginSession,canOpenMenu,canOpenLegacyMenu,allocationOnlySchedule,ProductionContent});',{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.None}}).outputText,ctx);
const account=(allocationGroup='C',grants=[])=>ctx.restoredLoginSession({login:'synthetic-queue-user',allocationGroup,grants});
const flatten=node=>node&&typeof node==='object'?[node,...React.Children.toArray(node.props?.children).flatMap(flatten)]:[];

test('explicit C/AB capability opens only production root and schedule, without injecting legacy grants',()=>{
 for(const group of ['C','AB']) {
  const session=account(group);
  assert.equal(session.allocationGroup,group);assert.equal(session.grants.length,0);
  assert.equal(ctx.canOpenMenu(session,'production'),true);
  assert.equal(ctx.canOpenMenu(session,'production','capacity-calendar'),true);
  assert.equal(ctx.canOpenLegacyMenu(session,'production','capacity-calendar'),false);
  assert.equal(ctx.allocationOnlySchedule(session),true);
  for(const view of ['sku','warehouse','bom','planning','users'])assert.equal(ctx.canOpenMenu(session,view),false);
  for(const child of ['production-report','report-work','report-progress','report-dashboard','report-output','report-payroll','weekly-capacity','report-review','capacity-summary','labor-adjustment','data-recovery'])assert.equal(ctx.canOpenMenu(session,'production',child),false,child);
  assert.equal(ctx.canOpenMenu(session,'sku','employees'),false);
 }
});
test('unknown/missing scope stays denied; quick-line does not inherit queue capability',()=>{
 for(const group of [undefined,null,'A','all'])assert.equal(ctx.canOpenMenu(account(group===undefined?null:group),'production','capacity-calendar'),false);
 const line=ctx.restoredLoginSession({login:'line-a',authMode:'quick_line',line:'A',allocationGroup:'C',grants:[]});
 assert.equal(line.allocationGroup,undefined);assert.equal(ctx.allocationOnlySchedule(line),false);
 assert.equal(ctx.canOpenMenu(line,'sku','employees'),false);
});
test('actual schedule rendering mounts only scoped queue for queue-only account, never legacy workflow',async()=>{
 for(const group of ['C','AB']) {
  const tree=ctx.ProductionContent({allocationOnly:ctx.allocationOnlySchedule(account(group)),section:'capacity-calendar',preferenceUser:'synthetic',operator:'Synthetic'});
  const nodes=flatten(tree),queue=nodes.find(n=>n.type===ctx.ProductionAllocationWorkspace);
  assert.ok(queue);assert.equal(nodes.some(n=>n.type===ctx.ProductionManagement),false);
  assert.equal(await queue.props.refresh(),true,'queue mutation refresh is self-contained, not a broad workflow reload');
 }
 const legacy=account('C',['Quản lý sản xuất / Capacity tuần / Xem']);
 assert.equal(ctx.allocationOnlySchedule(legacy),false);
 const tree=ctx.ProductionContent({allocationOnly:ctx.allocationOnlySchedule(legacy),section:'capacity-calendar',operator:'Synthetic'});
 assert.equal(tree.type,ctx.WeeklyCapacity);assert.equal(tree.props.view,'calendar');
});
test('queue capability changes invalidate client scope; cosmetics do not',()=>{
 const identity=group=>({authenticated:true,session:account(group)});
 assert.notEqual(clientAuthorizationKey(identity('C')),clientAuthorizationKey(identity('AB')));
 assert.notEqual(clientAuthorizationKey(identity('C')),clientAuthorizationKey(identity(null)));
 assert.equal(clientAuthorizationKey(identity('C')),clientAuthorizationKey({...identity('C'),session:{...account('C'),name:'Renamed'}}));
});
const workspace=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='WorkspaceSession');
function effectContaining(text){let result;const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0].getText(ast).includes(text))result=node.arguments[0].getText(ast);ts.forEachChild(node,visit);};visit(workspace);assert.ok(result);return result;}
test('queue-only session never schedules production-engine or labor-hours preload',()=>{
 for(const [needle,extra] of [['prefetchProductionEngine',{}],['preloadLaborHours',{view:'sku',activeChild:null}]]) {
  let calls=0;
  const context={...ctx,authenticated:true,active:true,scopeId:'workspace-home',session:account(),...extra,window:{setTimeout:()=>{calls++;},clearTimeout(){}},prefetchProductionEngine:()=>{calls++;},preloadLaborHours:()=>{calls++;}};
  vm.runInNewContext(ts.transpileModule(`(${effectContaining(needle)})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  assert.equal(calls,0,needle);
 }
});
test('sidebar and module overview expose the existing schedule route without exposing report workflow',()=>{
 assert.match(source,/canOpen\("production", "weekly-capacity"\) \|\| canOpen\("production", "capacity-calendar"\)/);
 assert.match(source,/<ProductionContent\s+allocationOnly=\{allocationOnlySchedule\(session\)\}/);
});

test('authorized home and unrelated menus do not start speculative planning reads; Engine alone schedules them',()=>{
 for(const [view,activeChild,wanted] of [['sku',null,0],['production','capacity-calendar',0],['planning',null,0],['planning','plan',0],['planning','proposal',1]]){
  let calls=0;const context={...ctx,authenticated:true,active:true,view,activeChild,session:{...account(),isAdmin:true},window:{setTimeout:()=>{calls++;return 1;},clearTimeout(){}},prefetchProductionEngine:()=>{throw Error('Timer must not execute during this test');}};
  vm.runInNewContext(ts.transpileModule(`(${effectContaining('prefetchProductionEngine')})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  assert.equal(calls,wanted,`${view}/${activeChild}`);
 }
});
