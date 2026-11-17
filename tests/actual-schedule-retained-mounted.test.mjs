import {trackBrowserChannels} from './helpers/browser-channels.mjs';const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer} from './helpers/vite-test-server.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),vite=await createTestServer(),originalFetch=globalThis.fetch;
const {default:Production}=await vite.ssrLoadModule('/components/production-management.tsx'),{clearProductionSnapshot}=await vite.ssrLoadModule('/lib/production-workflow-cache.ts'),{productionDisplayStore:store}=await vite.ssrLoadModule('/lib/production-display-store.mjs');
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
const week='2026-11-02';
const data={orders:[],reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:['A','B'].flatMap(line=>[week,'2026-11-09'].map(week=>({key:week+':'+line,line,version:4,days:Array.from({length:7},(_,i)=>({date:new Date(Date.parse(week)+i*86400000).toISOString().slice(0,10),working:i<6,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',note:'SAVED-'+line,ot:false})),roster:[]}))),rights:{manager:true,hr:true,line:null}};
const flush=()=>act(async()=>{await new Promise(r=>setTimeout(r,5));});
async function until(check){for(let i=0;i<150;i++){await flush();if(check())return;}assert.ok(check());}
async function mount(user='TEST',line){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(React.createElement(Production,{mode:'schedule',operator:user,preferenceUser:user,sessionLine:line,actualScheduleAllowed:true})));return{host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const button=(host,name)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===name||b.getAttribute('aria-label')===name);
async function choose(node,value){await act(async()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});}
async function input(node,value){await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});}
const lineSelect=host=>[...host.querySelectorAll('select')].find(s=>s.options.length===2&&s.options[0].value==='A');
async function reset(scope='TEST:grants:all'){store.clear();clearProductionSnapshot();await store.activate(scope);store.put('view:actual-schedule:calendar:TEST:',{week,line:'A'});}

test('calendar restores selected week/Line and saved rows before delayed network, then updates without losing context',async t=>{
 await reset();let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(data);};let screen=await mount();
 try{await until(()=>screen.host.querySelector('.actual-day-note'));await choose(lineSelect(screen.host),'B');await input(screen.host.querySelector('[aria-label="Tuần kế hoạch"]'),'2026-11-09');assert.equal(screen.host.querySelector('.actual-day-note').value,'SAVED-B');await screen.close();clearProductionSnapshot();
  let release;const gate=new Promise(r=>{release=r;});globalThis.fetch=async()=>{calls++;return gate;};const start=performance.now();screen=await mount();const displayMs=performance.now()-start;
  assert.equal(screen.host.querySelector('[aria-label="Tuần kế hoạch"]').value,'2026-11-09');assert.equal(lineSelect(screen.host).value,'B');assert.equal(screen.host.querySelector('.actual-day-note').value,'SAVED-B');assert.equal(button(screen.host,'Lưu thay đổi').getAttribute('aria-disabled'),'true');assert.equal(calls,2);
  const updated={...data,approvedSchedules:data.approvedSchedules.map(s=>({...s,version:5,days:s.days.map(d=>({...d,note:'NEW-'+s.line}))}))};release(Response.json(updated));await until(()=>screen.host.querySelector('.actual-day-note')?.value==='NEW-B');assert.equal(button(screen.host,'Lưu thay đổi').disabled,false);assert.equal(lineSelect(screen.host).value,'B');t.diagnostic(JSON.stringify({synthetic:true,displayMs,newDataMs:performance.now()-start}));
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});

test('monthly applied filters survive remount; unapplied toolbar drafts and edit reasons do not persist',async()=>{
 await reset();globalThis.fetch=async()=>Response.json(data);let screen=await mount();
 try{await until(()=>screen.host.querySelector('.actual-day-note'));await input(screen.host.querySelector('#actual-reason'),'UNSAVED');await act(async()=>button(screen.host,'Tổng hợp tháng').click());await choose(screen.host.querySelector('[aria-label="Line tra cứu"]'),'B');await input(screen.host.querySelector('[aria-label="Nhân viên tra cứu"]'),'Synthetic');await act(async()=>button(screen.host,'Tìm kiếm').click());await choose(screen.host.querySelector('[aria-label="Line tra cứu"]'),'A');await screen.close();screen=await mount();
 assert.equal(screen.host.querySelector('[data-actual-calendar]').hidden,true);assert.equal(screen.host.querySelector('[aria-label="Line tra cứu"]').value,'B');assert.equal(screen.host.querySelector('[aria-label="Nhân viên tra cứu"]').value,'Synthetic');const saved=store.get('view:actual-schedule:filters:TEST::A');assert.equal(saved.monthApplied.line,'B');assert.equal(saved.monthDraft.line,'B');await act(async()=>button(screen.host,'Quay lại').click());assert.equal(screen.host.querySelector('#actual-reason').value,'');
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});

test('changed account/grants/Line cannot restore old rows; 403 removes retained calendar',async()=>{
 await reset();globalThis.fetch=async()=>Response.json(data);let screen=await mount();
 try{await until(()=>screen.host.querySelector('.actual-day-note'));await screen.close();clearProductionSnapshot();await store.activate('OTHER:grants:B');let release;globalThis.fetch=()=>new Promise(r=>{release=r;});screen=await mount('OTHER','B');assert.equal(screen.host.querySelector('.actual-day-note'),null);release(Response.json({...data,approvedSchedules:[],rights:{manager:false,line:'B'}}));await until(()=>screen.host.querySelector('.actual-schedule'));assert.equal(lineSelect(screen.host).value,'B');assert.equal(lineSelect(screen.host).disabled,true);await screen.close();
 await reset();globalThis.fetch=async()=>Response.json(data);screen=await mount();await until(()=>screen.host.querySelector('.actual-day-note'));await screen.close();clearProductionSnapshot();globalThis.fetch=async()=>Response.json({error:'Denied'},{status:403});screen=await mount();await until(()=>screen.host.querySelector('[role="alert"]'));assert.equal(screen.host.querySelector('.actual-day-note'),null);assert.equal(store.active(),false);
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});

test('background refresh preserves unsaved draft and concurrency version; submit remains server checked',async()=>{
 await reset();let request;globalThis.fetch=async(url,opts)=>{if(opts?.method==='POST'){request=JSON.parse(opts.body);return Response.json({error:'Version changed'},{status:409});}return Response.json(data);};let screen=await mount();
 try{await until(()=>screen.host.querySelector('.actual-day-note'));await input(screen.host.querySelector('.actual-day-note'),'DRAFT');await input(screen.host.querySelector('#actual-reason'),'Synthetic change');await act(async()=>window.dispatchEvent(new CustomEvent('onspa-production-updated')));await flush();assert.equal(screen.host.querySelector('.actual-day-note').value,'DRAFT');await act(async()=>button(screen.host,'Lưu thay đổi').click());assert.equal(request.action,'schedule');assert.equal(request.approvedVersion,4);assert.equal(request.days[0].note,'DRAFT');assert.match(screen.host.textContent,/Version changed/);assert.equal(screen.host.querySelector('.actual-day-note').value,'DRAFT');
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});
