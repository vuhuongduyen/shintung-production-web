import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {productionOrderPageUrl} from '../lib/production-order-page-client.mjs';
test('login warmup stays inside allowed menus, serializes reads and stops at a session change',async()=>{
 const calls=[],exports={};let session=0,release;
 const code=ts.transpileModule(readFileSync(new URL('../lib/production-menu-warmup.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>({
  './data-sync':{clientSessionGeneration:()=>session},
  './production-page-cache':{readProductionPage:(url,identity)=>{calls.push([url,identity]);return new Promise(r=>{release=r;});}},
  './production-order-page-client.mjs':{productionOrderPageUrl},
  './production-workflow-cache':{readProductionWorkflow:async(_,profile)=>calls.push(profile)},
  './capacity-workspace-cache':{readCapacityLatest:async()=>calls.push('capacity')},
 })[name]});
 await exports.warmProductionMenus({login:'A',work:false,progress:true,schedule:false,capacity:false});assert.deepEqual(calls,['progress']);calls.length=0;
 const opening=exports.warmProductionMenus({login:'A',line:'A',work:true,progress:true,schedule:true,capacity:true});
 assert.deepEqual(calls,[['/api/production-order-pages?page=1&sort=due&line=A',JSON.stringify(['A','A'])]]);
 session++;release();await opening;assert.equal(calls.length,1,'do not warm another account after a late response');
 calls.length=0;await exports.warmProductionMenus({login:'A',work:false,progress:false,schedule:false,capacity:false});assert.deepEqual(calls,[]);
 await exports.warmProductionMenus({login:'A',work:true,progress:true,schedule:true,capacity:true,stopped:()=>true});assert.deepEqual(calls,[]);
});
