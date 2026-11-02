import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
import {validClockTime,localDateTimeError} from '../lib/clock-input.mjs';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:DateTime}=await vite.ssrLoadModule('/components/production-date-time-input.tsx');
const {default:Queue}=await vite.ssrLoadModule('/components/production-allocation-queue.tsx');
after(async()=>{await vite.close();dom.window.close();});
const setValue=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
async function mount(Component,props){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=async(next=props)=>act(async()=>root.render(React.createElement(Component,next)));await render();return {host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const field=(host,label)=>host.querySelector(`input[aria-label="${label}"]`);

test('24-hour validation preserves boundaries, date bounds and GMT+7 round trips',()=>{
 for(const time of ['00:00','12:00','23:59']){
  assert.equal(validClockTime(time),true);const local=`2026-10-19T${time}`;assert.equal(localDateTimeError(local),'');
  const instant=new Date(`${local}:00+07:00`).toISOString();assert.equal(productionDisplayTime(instant),`19/10/2026 ${time}:00`);
 }
 for(const time of ['24:00','12:60','9:00','09:00 AM','09:00 SA','-1:00'])assert.equal(validClockTime(time),false);
 assert.ok(localDateTimeError('2026-10-19T24:00'));assert.ok(localDateTimeError('2026-02-30T12:00'));
 assert.ok(localDateTimeError('2026-10-19T08:59',{min:'2026-10-19T09:00'}));assert.ok(localDateTimeError('2026-10-19T17:01',{max:'2026-10-19T17:00'}));
});
test('real date-time component edits HH:mm, rejects 24:00 and range errors, and preserves form payload',async()=>{
 let value='2026-10-19T08:00';const values=[];
 const props=()=>({name:'instant',label:'Thời gian',value,min:'2026-10-19T00:00',max:'2026-10-19T23:59',onChange:next=>{value=next;values.push(next);}});
 const m=await mount(DateTime,props());try{
  assert.equal(m.host.querySelector('input[type=datetime-local],input[type=time]'),null);
  for(const t of ['00:00','12:00','23:59']){await setValue(field(m.host,'Thời gian · giờ'),t);await m.render(props());assert.equal(value,`2026-10-19T${t}`);assert.equal(field(m.host,'Thời gian · giờ').checkValidity(),true);assert.equal(m.host.querySelector('[name=instant]').value,value);}
  await setValue(field(m.host,'Thời gian · giờ'),'24:00');assert.equal(value,'2026-10-19T23:59');assert.equal(field(m.host,'Thời gian · giờ').checkValidity(),false);
  await act(async()=>field(m.host,'Thời gian · giờ').dispatchEvent(new Event('focusout',{bubbles:true})));assert.equal(field(m.host,'Thời gian · giờ').value,'24:00');
  value='2026-10-19T08:00';await m.render({...props(),min:'2026-10-19T09:00'});assert.equal(field(m.host,'Thời gian · ngày').checkValidity(),false);
  await m.render({...props(),disabled:true});assert.equal(field(m.host,'Thời gian · giờ').disabled,true);
  assert.doesNotMatch(m.host.textContent,/\b(?:AM|PM|SA|CH)\b/);
 }finally{await m.close();}
});
const view={revision:1,group:'C',sourceLines:['C'],offers:[],pendingPeople:0};
const base={view,candidates:[{id:'c1',name:'Synthetic',line:'C'}],busy:false,onCommand:async()=>false,now:'2026-10-17T02:22:00Z',planningDate:'2026-10-19'};
test('offer defaults 08–17; edited dates and hours survive polls and planning-week changes',async()=>{
 const m=await mount(Queue,base);try{
  assert.equal(field(m.host,'Đề nghị từ ngày giờ · ngày').value,'2026-10-19');assert.equal(field(m.host,'Đề nghị từ ngày giờ · giờ').value,'08:00');assert.equal(field(m.host,'Đề nghị đến ngày giờ · giờ').value,'17:00');
  await setValue(field(m.host,'Đề nghị từ ngày giờ · giờ'),'10:15');await setValue(field(m.host,'Đề nghị đến ngày giờ · giờ'),'16:45');
  await m.render({...base,now:'2026-10-17T03:30:00Z',view:{...view,revision:2}});assert.equal(field(m.host,'Đề nghị từ ngày giờ · giờ').value,'10:15');assert.equal(field(m.host,'Đề nghị đến ngày giờ · giờ').value,'16:45');
  await m.render({...base,planningDate:'2026-10-20'});assert.equal(field(m.host,'Đề nghị từ ngày giờ · ngày').value,'2026-10-19');assert.equal(field(m.host,'Đề nghị đến ngày giờ · ngày').value,'2026-10-19');assert.equal(field(m.host,'Đề nghị từ ngày giờ · giờ').value,'10:15');
  await setValue(field(m.host,'Đề nghị từ ngày giờ · ngày'),'2026-10-21');assert.equal(field(m.host,'Đề nghị đến ngày giờ · ngày').value,'2026-10-21');assert.equal(field(m.host,'Đề nghị đến ngày giờ · giờ').value,'16:45');
 }finally{await m.close();}
});
test('past default stays 08–17 with explanation; receivers retain offered bounds',async()=>{
 const window={effectiveAt:'2026-10-19T03:00:00Z',endsAt:'2026-10-19T07:00:00Z'};
 const offer={id:'offer',sourceLine:'A',sourceGroup:'AB',targetGroup:'C',...window,canAllocate:true,canWithdraw:false,expired:false,people:[{id:'a1',name:'Offered',pending:[window]}],allocations:[],withdrawals:[]};
 const m=await mount(Queue,{...base,planningDate:'2026-10-17',view:{...view,offers:[offer]}});try{
  assert.equal(field(m.host,'Đề nghị từ ngày giờ · giờ').value,'08:00');assert.match(m.host.textContent,/Giờ bắt đầu đã qua/);
  assert.equal(field(m.host,'Phân bổ từ ngày giờ · giờ'),null);
  await act(async()=>m.host.querySelector('#allocation-pending tbody input').click());
  assert.equal(field(m.host,'Phân bổ từ ngày giờ · giờ').value,'10:00');assert.equal(field(m.host,'Phân bổ đến ngày giờ · giờ').value,'14:00');
  await setValue(field(m.host,'Phân bổ từ ngày giờ · giờ'),'09:00');assert.equal(m.host.querySelector('[aria-label="Phân bổ nhân viên đã chọn"] button[type=submit]').disabled,true);
 }finally{await m.close();}
});
test('reachable source contains no locale-dependent native time controls',()=>{
 const scan=dir=>readdirSync(new URL('../'+dir,import.meta.url),{withFileTypes:true}).flatMap(item=>item.isDirectory()?scan(`${dir}/${item.name}`):/\.(tsx|jsx)$/.test(item.name)?[`${dir}/${item.name}`]:[]);
 for(const path of [...scan('components'),...scan('app')])assert.doesNotMatch(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/type=["'](?:datetime-local|time)["']/,path);
 for(const locale of ['vi-VN','zh-TW','en-GB'])for(const time of ['2026-10-18T17:00:00Z','2026-10-19T05:00:00Z','2026-10-19T16:59:00Z']){
  const displayed=new Date(time).toLocaleString(locale,{timeZone:'Asia/Ho_Chi_Minh',hourCycle:'h23'});assert.doesNotMatch(displayed,/\b(?:AM|PM|SA|CH)\b|上午|下午/);
 }
});


test('untouched offer defaults follow the planning date while retaining 08–17',async()=>{
 const m=await mount(Queue,base);try{
  await m.render({...base,planningDate:'2026-10-20'});
  assert.equal(field(m.host,'Đề nghị từ ngày giờ · ngày').value,'2026-10-20');assert.equal(field(m.host,'Đề nghị đến ngày giờ · ngày').value,'2026-10-20');
  assert.equal(field(m.host,'Đề nghị từ ngày giờ · giờ').value,'08:00');assert.equal(field(m.host,'Đề nghị đến ngày giờ · giờ').value,'17:00');
 }finally{await m.close();}
});
