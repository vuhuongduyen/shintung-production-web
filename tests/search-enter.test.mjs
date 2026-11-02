import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const {JSDOM} = createRequire(import.meta.url)('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'https://synthetic.test'});
for (const name of ['window','document','HTMLElement','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act, useState} = React;
const {createRoot} = await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {StandardToolbar,toolbar,ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
const {ActionFeedbackHost}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const {FeedbackInbox}=await vite.ssrLoadModule('/components/user-feedback.tsx');
const {default:ActualWorkSchedule}=await vite.ssrLoadModule('/components/actual-work-schedule.tsx');
const {default:PlanningReports}=await vite.ssrLoadModule('/components/planning-reports.tsx');
after(async()=>{await vite.close();dom.window.close();});
const el = React.createElement;
async function mount(component) {
  const host=document.createElement('div'); document.body.append(host); const root=createRoot(host);
  await act(async()=>root.render(component));
  return {host, async close(){await act(async()=>root.unmount());host.remove();}};
}
async function key(input, options={}) {await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options})));}
async function change(input,value) {await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});}
async function click(button) {await act(async()=>button.click());}
function fixture({calls, deferred=true, disabled=false, allowed=true, callback, inputProps={}, legacy=()=>{}, dialog=false}) {
 function View(){
  const [query,setQuery]=useState(''),[page,setPage]=useState(4);
  return el(dialog?'section':'div',dialog?{role:'dialog'}:{},el(StandardToolbar,{name:'SyntheticSearch',permissionFeedback:false,items:[
   toolbar.field(deferred?'TRA THEO':'Trạng thái',[toolbar.select({defaultValue:''},el('option',{value:''},'All'))]),
   toolbar.field('NỘI DUNG TRA',[toolbar.input({value:query,onChange:e=>setQuery(e.target.value),onKeyDown:legacy,...inputProps})]),
   toolbar.action({disabled,onClick:()=>{calls.push(query);setPage(1);return callback?.();}},'Tìm kiếm',allowed,'search'),
   toolbar.action({onClick:()=>{throw Error('Save must not run');}},'Lưu',true,'action'),
  ]}),el('output',null,page));
 }
 return el(View);
}

test('mounted Enter and click each call the latest search once, apply deferred query and reset page',async()=>{
 for(const deferred of [true,false]){
  const calls=[];let legacy=0;const view=await mount(fixture({calls,deferred,legacy:()=>legacy++}));
  const input=view.host.querySelector('input'); await change(input,'SKU-ENTER');await key(input);
  assert.deepEqual(calls,['SKU-ENTER']);assert.equal(view.host.querySelector('output').textContent,'1');assert.equal(legacy,0);
  await change(input,'SKU-CLICK');await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tìm kiếm'));
  assert.deepEqual(calls,['SKU-ENTER','SKU-CLICK']);await view.close();
 }
});
test('IME, held Enter and modified Enter never run search or old raw handlers',async()=>{
 const calls=[];let legacy=0;const view=await mount(fixture({calls,legacy:()=>legacy++}));const input=view.host.querySelector('input');
 for(const options of [{isComposing:true},{keyCode:229},{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])await key(input,options);
 assert.deepEqual(calls,[]);assert.equal(legacy,0);await key(input,{key:'ArrowDown'});assert.equal(legacy,1);await view.close();
});
test('pending promise, disabled button and denied permission cannot launch repeat searches',async()=>{
 let finish;const calls=[];const view=await mount(fixture({calls,callback:()=>new Promise(r=>finish=r)}));const input=view.host.querySelector('input');
 await key(input);await key(input);await key(view.host.querySelector('select'));await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tìm kiếm'));assert.equal(calls.length,1);
 await act(async()=>finish());await key(input);assert.equal(calls.length,2);await act(async()=>finish());await view.close();
 for(const props of [{disabled:true},{allowed:false}]){
  const calls=[];const view=await mount(fixture({calls,...props}));await key(view.host.querySelector('input'));await key(view.host.querySelector('select'));assert.deepEqual(calls,[]);await view.close();
 }
 const deniedCalls=[];const denied=await mount(el(ToolbarPermissions.Provider,{value:()=>false},fixture({calls:deniedCalls})));
 await key(denied.host.querySelector('input'));await key(denied.host.querySelector('select'));assert.deepEqual(deniedCalls,[]);assert.equal(denied.host.querySelectorAll('button').length,0);await denied.close();
});
test('native select, editor textarea, unrelated input and dialog controls keep their Enter behavior',async()=>{
 const calls=[];let save=0;const view=await mount(el('form',{onSubmit:e=>{e.preventDefault();save++;}},fixture({calls,dialog:true}),el('textarea'),el('input',{'data-editor':true}),el('button',{type:'submit'},'Save editor')));
 const nativeSelect=view.host.querySelector('select');nativeSelect.matches=selector=>selector===':open';await key(nativeSelect);await key(view.host.querySelector('textarea'));await key(view.host.querySelector('[data-editor]'));assert.deepEqual(calls,[]);
 const event=new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});await act(async()=>view.host.querySelector('input').dispatchEvent(event));
 assert.equal(event.defaultPrevented,true);assert.equal(calls.length,1);assert.equal(save,0);await view.close();
});
test('open autocomplete and native datalist preserve option acceptance, closed autocomplete can search',async()=>{
 for(const inputProps of [{'aria-expanded':true,role:'combobox'},{'aria-activedescendant':'option-1'},{type:'file'},{type:'checkbox'},{readOnly:true}]){
  const calls=[];const view=await mount(fixture({calls,inputProps}));await key(view.host.querySelector('input'));assert.equal(calls.length,0);await view.close();
 }
 const calls=[];const view=await mount(el('div',null,fixture({calls,inputProps:{list:'suggestions'}}),el('datalist',{id:'suggestions'},el('option',{value:'SKU'}))));await key(view.host.querySelector('input'));assert.equal(calls.length,0);await view.close();
 let selected=0;const picker=await mount(fixture({calls:[],inputProps:{role:'combobox','aria-expanded':true},legacy:e=>{if(e.key==='Enter'){e.preventDefault();selected++;}}}));await key(picker.host.querySelector('input'));assert.equal(selected,1);await picker.close();
 const closedCalls=[];const closed=await mount(fixture({calls:closedCalls,inputProps:{role:'combobox','aria-expanded':false}}));await key(closed.host.querySelector('input'));assert.equal(closedCalls.length,1);await closed.close();
});
test('draft-only legacy toolbar Enter equals its generated search button without running a raw callback',async()=>{
 let applied='',legacy=0;
 function DraftOnly(){const [value,setValue]=useState('');return el(StandardToolbar,{items:[toolbar.field('TRA THEO',[toolbar.select({},el('option',null,'SKU'))]),toolbar.field('NỘI DUNG TRA',[toolbar.input({value,onChange:e=>{applied=e.target.value;setValue(applied);},onKeyDown:()=>legacy++})])]});}
 const view=await mount(el(DraftOnly));
 await change(view.host.querySelector('input'),'SKU-DRAFT');assert.equal(applied,'');await key(view.host.querySelector('input'));assert.equal(applied,'SKU-DRAFT');assert.equal(legacy,0);await view.close();
});

test('real FeedbackInbox searches by Enter and click in all three languages and blocks Enter while loading',async()=>{
 const originalFetch=globalThis.fetch;
 try {
  for(const language of ['vi','en','zh']){
   const requests=[];let resolveRead;let hold=false;
   globalThis.fetch=async url=>{requests.push(String(url));if(hold)await new Promise(r=>resolveRead=r);return Response.json({records:[],total:0});};
   const view=await mount(el(FeedbackInbox,{language}));assert.equal(requests.length,1);
   const input=view.host.querySelector('input[type=text]');await change(input,'ENTER-CHECK');hold=true;await key(input);
   assert.equal(requests.length,2);assert.equal(new URL(requests[1],'https://synthetic.test').searchParams.get('q'),'ENTER-CHECK');
   await key(input);assert.equal(requests.length,2);
   hold=false;await act(async()=>resolveRead());
   await change(input,'CLICK-CHECK');await click([...view.host.querySelectorAll('button')].find(b=>['Tìm kiếm','Search','搜尋'].includes(b.textContent)));
   assert.equal(requests.length,3);assert.equal(new URL(requests[2],'https://synthetic.test').searchParams.get('q'),'CLICK-CHECK');await view.close();
  }
 } finally {globalThis.fetch=originalFetch;}
});
test('date filter Enter uses the search action and an input without search keeps its custom keyboard handler',async()=>{
 const calls=[];const view=await mount(fixture({calls,deferred:false,inputProps:{type:'date'}}));await change(view.host.querySelector('input'),'2026-10-16');await key(view.host.querySelector('input'));assert.deepEqual(calls,['2026-10-16']);await view.close();
 let keys=0;const plain=await mount(el(StandardToolbar,{items:[toolbar.input({onKeyDown:()=>keys++})]}));await key(plain.host.querySelector('input'));assert.equal(keys,1);await plain.close();
});

test('held Enter is prevented from falling through to a parent editor form',async()=>{
 const calls=[];const view=await mount(fixture({calls}));const event=new window.KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true});await act(async()=>view.host.querySelector('input').dispatchEvent(event));assert.equal(event.defaultPrevented,true);assert.equal(calls.length,0);await view.close();
});
test('real PlanningReports criteria Enter and semantic submit use the guarded Preview action',async()=>{
 const originalFetch=globalThis.fetch;const requests=[];let hold=false,resolveRead;
 globalThis.fetch=async url=>{requests.push(String(url));if(hold)await new Promise(r=>resolveRead=r);return Response.json({rows:[]});};
 try {
  const view=await mount(el(PlanningReports,{reportType:'all',onClose:()=>{throw Error('must not close');}}));assert.equal(requests.length,1);
  const input=view.host.querySelector('input:not([type])');await change(input,'SKU-REPORT');hold=true;await key(input);assert.equal(requests.length,2);
  await key(input);await key(input,{repeat:true});assert.equal(requests.length,2);hold=false;await act(async()=>resolveRead());
  await key(input,{isComposing:true});await key(input,{keyCode:229});const reportSelect=view.host.querySelector('select');reportSelect.matches=selector=>selector===':open';await key(reportSelect);assert.equal(requests.length,2);reportSelect.matches=()=>false;
  const dates=view.host.querySelectorAll('input[type=date]');await change(dates[1],'2026-10-20');await change(dates[2],'2026-10-16');await key(dates[2]);assert.equal(requests.length,2);assert.match(view.host.querySelector('[role=alert]').textContent,/Từ ngày phải trước/);
  await change(dates[2],'2026-10-25');await act(async()=>view.host.querySelector('form').requestSubmit());assert.equal(requests.length,3);
  await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Xem trước'));assert.equal(requests.length,4);await key(reportSelect);assert.equal(requests.length,5);await view.close();
  const denied=await mount(el(ToolbarPermissions.Provider,{value:(_name,label)=>label!=='Xem trước'},el(PlanningReports,{reportType:'all',onClose:()=>{}})));assert.equal(requests.length,6);await key(denied.host.querySelector('input:not([type])'));assert.equal(requests.length,6);await denied.close();
 } finally {globalThis.fetch=originalFetch;}
});

test('blocked Enter explains disabled toolbar search without invoking search, legacy handler or form submit',async()=>{
 let calls=0,legacy=0,submits=0;
 const view=await mount(el(React.Fragment,null,el(ActionFeedbackHost),el('form',{onSubmit:e=>{e.preventDefault();submits++;}},el(StandardToolbar,{items:[
  toolbar.input({onKeyDown:()=>legacy++}),
  toolbar.action({disabled:true,disabledExplanation:'Chọn một dòng trước khi tra cứu.',onClick:()=>calls++},'Tìm kiếm',true,'search'),
 ]}))));
 const input=view.host.querySelector('input');await key(input);
 assert.match(view.host.querySelector('[role=alert]').textContent,/Chọn một dòng/);
 assert.equal(calls,0);assert.equal(legacy,0);assert.equal(submits,0);
 assert.equal(view.host.querySelector('[data-feedback-button] button').disabled,true);
 await view.close();
});
test('PlanningReports semantic submit explains busy Preview without duplicate request',async()=>{
 const originalFetch=globalThis.fetch;let calls=0,hold=false,finish;
 globalThis.fetch=async()=>{calls++;if(hold)await new Promise(r=>finish=r);return Response.json({rows:[]});};
 let view;
 try{
  view=await mount(el(React.Fragment,null,el(ActionFeedbackHost),el(PlanningReports,{reportType:'all',onClose:()=>{}})));
  assert.equal(calls,1);hold=true;await key(view.host.querySelector('input:not([type])'));assert.equal(calls,2);
  await act(async()=>view.host.querySelector('form').requestSubmit());
  assert.equal(calls,2);assert.match(view.host.querySelector('[role=alert]').textContent,/Đang xử lý/);
  hold=false;await act(async()=>finish());
 }finally{if(view)await view.close();globalThis.fetch=originalFetch;}
});
function actualFixture(overrides={}) {return el(ActualWorkSchedule,{week:'2026-10-19',setWeek:()=>{},line:'A',setLine:()=>{},locked:false,days:[],setDays:()=>{},version:1,approvedSchedules:[],history:[],events:[],orders:[],employees:[],manager:false,hr:false,busy:false,save:async()=>{throw Error('HR save must not run');},openAction:()=>{},refresh:async()=>true,...overrides});}
async function choose(select,value){await act(async()=>{select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));});}
test('ACTUAL schedule monthly lookup Enter from month field opens chosen month without touching HR save',async()=>{
 const view=await mount(actualFixture());await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tổng hợp tháng'));
 const toolbar=view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');await choose(toolbar.querySelector('select'),'Tổng hợp tháng');
 const month=toolbar.querySelector('input[type=month]');assert.ok(month);await change(month,'2026-11');assert.equal(view.host.querySelector('.actual-month-results'),null);
 await key(month);assert.ok(view.host.querySelector('.actual-month-results'));assert.equal(view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule] input[type=month]').value,'2026-11');await view.close();
});
test('ACTUAL schedule category select accepts an open picker then closed Enter applies monthly lookup',async()=>{
 const view=await mount(actualFixture());await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tổng hợp tháng'));const select=view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule] select');await choose(select,'Tổng hợp tháng');select.matches=selector=>selector===':open';await key(select);assert.equal(view.host.querySelector('.actual-month-results'),null);select.matches=()=>false;await key(select);assert.ok(view.host.querySelector('.actual-month-results'));await view.close();
});

test('ACTUAL schedule closed Line filter Enter equals click and cannot change a locked or busy Line',async()=>{
 for(const method of ['enter','click']){
  const calls=[];const view=await mount(actualFixture({setLine:value=>calls.push(value)}));await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tổng hợp tháng'));
  const toolbar=view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');await choose(toolbar.querySelector('select'),'Line');const selects=toolbar.querySelectorAll('select');await choose(selects[1],'B');assert.deepEqual(calls,[]);
  if(method==='enter')await key(selects[1]);else await click([...toolbar.querySelectorAll('button')].find(b=>b.textContent==='Tìm kiếm'));
  assert.deepEqual(calls,['B']);await view.close();
 }
 for(const mode of [{locked:true},{busy:true}]){
  const calls=[];const view=await mount(actualFixture({...mode,setLine:value=>calls.push(value)}));await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tổng hợp tháng'));const toolbar=view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');await choose(toolbar.querySelector('select'),'Line');await key(toolbar.querySelectorAll('select')[1]);assert.deepEqual(calls,[]);await view.close();
 }
});
test('ACTUAL schedule week Enter normalizes date once and IME/repeated keys do not apply or touch HR form',async()=>{
 const weeks=[];let saves=0;const view=await mount(actualFixture({hr:true,approved:{version:1,days:[]},setWeek:value=>weeks.push(value),save:async()=>{saves++;return true;}}));await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tổng hợp tháng'));
 const toolbar=view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');await choose(toolbar.querySelector('select'),'Tuần');const date=toolbar.querySelector('input[type=date]');await change(date,'2026-11-04');
 await key(date,{isComposing:true});await key(date,{keyCode:229});await key(date,{repeat:true});assert.deepEqual(weeks,[]);await key(date);assert.deepEqual(weeks,['2026-11-02']);
 assert.equal(view.host.querySelector('.actual-line-leave'),null);assert.equal(saves,0);assert.deepEqual(weeks,['2026-11-02']);await view.close();
});
test('shared lookup selects preserve open selection, ignore IME/repeat, apply closed Enter once and support older picker fallback',async()=>{
 const calls=[];const view=await mount(fixture({calls}));const select=view.host.querySelector('select');
 select.matches=()=>true;await key(select);assert.equal(calls.length,0);
 select.matches=()=>false;for(const options of [{isComposing:true},{keyCode:229},{repeat:true},{altKey:true},{ctrlKey:true}])await key(select,options);assert.equal(calls.length,0);
 await key(select);assert.equal(calls.length,1);
 select.matches=()=>{throw Error('unsupported pseudo-class');};await key(select,{key:' '});await choose(select,'');await key(select);assert.equal(calls.length,1);await key(select);assert.equal(calls.length,2);await view.close();
});

test('ACTUAL schedule older-browser pointer fallback conservatively requires a second Enter or refocus',async()=>{
 const calls=[];const view=await mount(actualFixture({setLine:value=>calls.push(value)}));await click([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tổng hợp tháng'));const toolbar=view.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');await choose(toolbar.querySelector('select'),'Line');const select=toolbar.querySelectorAll('select')[1];select.matches=()=>{throw Error('unsupported :open');};
 await act(async()=>select.dispatchEvent(new window.Event('pointerdown',{bubbles:true})));await choose(select,'B');await key(select);assert.deepEqual(calls,[]);await key(select);assert.deepEqual(calls,['B']);await act(async()=>select.dispatchEvent(new window.Event('pointerdown',{bubbles:true})));await choose(select,'A');await act(async()=>select.dispatchEvent(new window.FocusEvent('focusout',{bubbles:true})));await key(select);assert.deepEqual(calls,['B','A']);await view.close();
});

test('closed select Enter explains disabled and denied search without invoking callbacks or editor submit',async()=>{
 for(const mode of ['disabled','denied']){
  let calls=0,submits=0;
  const view=await mount(el(React.Fragment,null,el(ActionFeedbackHost),el('form',{onSubmit:e=>{e.preventDefault();submits++;}},el(StandardToolbar,{items:[
   toolbar.field('Trạng thái',[toolbar.select({},el('option',{value:'all'},'All'))]),
   toolbar.action({disabled:mode==='disabled',disabledExplanation:'Chọn dữ liệu trước khi tra cứu.',onClick:()=>calls++},'Tìm kiếm',mode!=='denied','search'),
  ]}))));
  const select=view.host.querySelector('select');select.matches=()=>false;
  const event=new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  await act(async()=>select.dispatchEvent(event));
  assert.equal(event.defaultPrevented,true);assert.equal(calls,0);assert.equal(submits,0);
  assert.match(view.host.querySelector('[role=alert]').textContent,mode==='disabled'?/Chọn dữ liệu/:/không có quyền/);
  if(mode==='disabled')assert.equal(view.host.querySelector('[data-feedback-button] button').disabled,true);
  await view.close();
 }
});
