import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {tableExportReport} from '../lib/table-report.mjs';
const source=readFileSync(new URL('../components/table-reports.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
function harness({enabled=true,rows=[['TEST-SKU',3]]}={}){
 let value=null,effectIndex=0;const effects=[],listeners=new Map(),data={title:'Synthetic export',headers:['SKU','Quantity'],rows};
 const table={dataset:{reportSource:JSON.stringify(data)},tHead:{},getClientRects:()=>[{}],closest:()=>null,parentElement:{closest:()=>null}};
 const main={querySelectorAll:()=>[table]},button={closest:()=>main},root={contains:b=>b===button};
 const document={getElementById:id=>id==='own-workspace'?root:null,createElement:()=>{throw Error('No injected menu button/host permitted')}};
 const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}};
 const hooks={useState:()=>[value,v=>{value=v}],useEffect:(fn,deps)=>{const i=effectIndex++,old=effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();effects[i]={deps,cleanup:fn()};}}};
 const require=name=>name==='react'?hooks:name.endsWith('table-report.mjs')?{tableExportReport}:{default:'ReportPreview',__esModule:true};
 const module={exports:{}};new Function('require','module','exports','React','document','window',js)(require,module,module.exports,React,document,window);
 let resetKey='initial';const render=()=>{effectIndex=0;return module.exports.default({scopeId:'own-workspace',resetKey,enabled})};
 const dispatch=(target=button)=>{let prevented=false;listeners.get('onspa-table-export')?.({detail:{button:target},preventDefault:()=>prevented=true});return prevented};
 return {render,dispatch,listeners,get report(){return value},reset(){resetKey='next';render()},dispose(){effects.forEach(e=>e.cleanup?.())}};
}
test('generic table reporter never renders or injects a standalone file-preview button',()=>{
 const h=harness();assert.equal(h.render(),null);assert.equal(h.report,null);assert.doesNotMatch(source,/Xem trước file|Preview file|預覽檔案|createPortal|MutationObserver|createElement|onspa-report-host/);h.dispose();
});
test('existing explicit export event still opens the shared download dialog using the same snapshot generator',()=>{
 const h=harness();h.render();assert.ok(h.listeners.has('onspa-table-export'));assert.equal(h.dispatch(),true);const preview=h.render();assert.equal(preview.type,'ReportPreview');assert.equal(preview.props.report,h.report);assert.ok(JSON.stringify(h.report).includes('TEST-SKU'));preview.props.close();assert.equal(h.render(),null);h.dispose();assert.equal(h.listeners.size,0);
});
test('export bridge preserves disabled scope, foreign-workspace isolation and empty-table fallback',()=>{
 const off=harness({enabled:false});off.render();assert.equal(off.listeners.size,0);assert.equal(off.dispatch(),false);
 const h=harness();h.render();assert.equal(h.dispatch({closest:()=>null}),false);assert.equal(h.report,null);h.dispose();
 const empty=harness({rows:[]});empty.render();assert.equal(empty.dispatch(),false);assert.equal(empty.report,null);empty.dispose();
});
test('menu changes still close the report and explicit downloads remain implemented',()=>{
 const h=harness();h.render();h.dispatch();assert.ok(h.report);h.reset();assert.equal(h.report,null);h.dispose();
 const preview=readFileSync(new URL('../components/report-preview.tsx',import.meta.url),'utf8');assert.match(preview,/download\('xlsx'\)/);assert.match(preview,/download\('pdf'\)/);assert.match(preview,/payrollXlsx\(report\)/);assert.match(preview,/payrollPdf\(report\)/);
});
