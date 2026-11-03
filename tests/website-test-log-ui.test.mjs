import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../components/website-test-log.tsx',import.meta.url),'utf8');
function harness(){
 const state=[];let cursor=0;const effects=[];const module={exports:{}};
 const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useEffect(fn){effects.push(fn);}};
 const toolbar={action:(props,label,allowed,intent,backLevel)=>({kind:'action',props,label,allowed,intent,backLevel}),input:props=>({kind:'input',props}),select:(props,options)=>({kind:'select',props,options}),field:(label,items)=>({kind:'field',label,items})};
 const aliases={};const symbol=name=>aliases[name]||(aliases[name]=()=>null);
 const localRequire=name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):name.includes('data-sync')?{apiFetch(){throw Error('Render must not fetch directly');},subscribeClientReadInvalidation(){return()=>{};}}:name.includes('production-display-time')?{productionDisplayTime:v=>v}:name.includes('StandardToolbar')?{StandardToolbar:symbol('StandardToolbar'),toolbar}:Object.fromEntries(['DataTable','DataCell','PageTitle','ManualPagination','Dialog','DialogContent','DialogTitle','DialogDescription'].map(k=>[k,symbol(k)]));
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:localRequire,URLSearchParams});
 const render=(language='vi')=>{cursor=0;effects.length=0;return module.exports.WebsiteTestLog({language});};
 const find=(node,type)=>{if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const found=find(child,type);if(found)return found;}return null;}return node.type===type?node:find(node.props?.children,type);};
 return {state,effects,render,find,aliases,items:tree=>find(tree,aliases.StandardToolbar).props.items.filter(Boolean)};
}
test('lookup opens blank without applying filters; selecting a field preserves current results until search',()=>{
 const h=harness();let tree=h.render();let items=h.items(tree);assert.equal(items.some(i=>i.kind==='field'),false);
 const applied={actor:'OLD',entity:'',action:'',q:'',from:'',to:''};h.state[2]=applied;
 items.find(i=>i.label==='Tra cứu').props.onClick();tree=h.render();items=h.items(tree);
 const by=items.find(i=>i.label==='Tra theo');assert.equal(by.items[0].props.value,'');assert.equal(h.state[2],applied);assert.equal(items.some(i=>i.label==='Nội dung tra'),false);
 by.items[0].props.onChange({target:{value:'actor'}});tree=h.render();items=h.items(tree);items.find(i=>i.label==='Nội dung tra').items[0].props.onChange({target:{value:'NEW'}});assert.equal(h.state[2],applied);
 tree=h.render();items=h.items(tree);items.find(i=>i.label==='Tìm kiếm').props.onClick();assert.equal(h.state[2].actor,'NEW');assert.equal(h.state[5],0);
});
test('back closes lookup without clearing applied filter; clear resets filters and pagination',()=>{
 const h=harness();h.render();h.state[3]=true;h.state[4]='q';h.state[2]={actor:'USER',entity:'sku',action:'update',q:'S1',from:'',to:''};h.state[5]=100;
 let items=h.items(h.render());items.find(i=>i.label==='Quay lại').props.onClick();assert.equal(h.state[3],false);assert.equal(h.state[2].q,'S1');assert.equal(h.state[5],100);
 h.state[3]=true;items=h.items(h.render());items.find(i=>i.label==='Xóa lọc').props.onClick();assert.equal(h.state[2].q,'');assert.equal(h.state[2].actor,'');assert.equal(h.state[5],0);
});
test('new screen supplies localized titles and shared table/pagination in all three languages',()=>{
 for(const [locale,title]of[['vi','Nhật ký test website'],['en','Website test log'],['zh','網站測試紀錄']]){const h=harness();const tree=h.render(locale);assert.equal(h.find(tree,h.aliases.PageTitle).props.children,title);assert.equal(h.find(tree,h.aliases.DataTable).props.className,'table-wrap');assert.ok(h.find(tree,h.aliases.ManualPagination));}
});
test('menu integration is admin-only and routes to a separate component',()=>{
 const page=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');const start=page.indexOf('{isAdmin && view === "users" && (');const end=page.indexOf('{allowedViews.has("sku")',start);assert.ok(start>=0&&end>start);assert.match(page.slice(start,end),/onChild\("users", "test-log"\)/);assert.match(page,/section === "test-log"\) return <WebsiteTestLog/);assert.match(source,/subscribeClientReadInvalidation/);
});
test('initial and cleared date range starts on the requested Vietnam calendar day',()=>{
 const h=harness();h.render();assert.equal(h.state[1].from,'2026-10-16');assert.equal(h.state[2].from,'2026-10-16');h.state[3]=true;h.state[1]={...h.state[1],from:'2026-10-20'};const items=h.items(h.render());items.find(i=>i.label==='Xóa lọc').props.onClick();assert.equal(h.state[1].from,'2026-10-16');assert.equal(h.state[2].from,'2026-10-16');
});
test('hidden-only warnings have explicit counts instead of a misleading zero total',()=>{
 const h=harness();h.render();h.state[0]={...h.state[0],warningCount:0,reviewHints:[{id:'hint',menu:'SKU',record:'S1',at:'2026-10-16T00:00:00Z',code:'large_labor_hour_change',evidence:{before:1,after:3}}]};
 const label=h.items(h.render()).find(item=>item.label?.includes('dòng hiển thị')).label;
 assert.match(label,/0 dòng hiển thị, 1 cảnh báo từ thao tác ẩn/);
});
test('detail modal explicitly overrides the narrow default and wraps long record IDs',()=>{
 assert.match(source,/width:'min\(1100px, calc\(100vw - 32px\)\)'/);assert.match(source,/maxWidth:'calc\(100vw - 32px\)'/);assert.match(source,/DialogTitle style=\{\{paddingRight:24,overflowWrap:'anywhere'\}\}/);
});
