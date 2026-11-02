import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','localStorage'])globalThis[k]=dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:Workspace}=await vite.ssrLoadModule('/components/production-allocation-workspace.tsx');
const {default:Capacity}=await vite.ssrLoadModule('/components/weekly-capacity.tsx');
const cache=await vite.ssrLoadModule('/lib/capacity-workspace-cache.ts');
const sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close();});
const data=(revision=1)=>({revision,readOnly:false,group:'C',sourceLines:['C'],pendingPeople:0,offers:[],candidates:[{id:'C1',name:'Nhân viên kiểm thử',line:'C'}]});
const settle=async()=>act(async()=>{await new Promise(r=>setTimeout(r,20));});
const button=(host,label)=>[...host.querySelectorAll('button')].find(n=>n.textContent.trim()===label);
const click=async n=>{assert.ok(n);await act(async()=>n.click());};
const input=async(n,value)=>{assert.ok(n);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,value);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));});};
function network(){const reads=[],posts=[];globalThis.fetch=(path,init={})=>{if(init.method==='POST'){posts.push({path,body:init.body});return Promise.resolve(Response.json({error:'Unexpected write'},{status:403}));}return new Promise(resolve=>reads.push({path:String(path),done:(body,status=200)=>resolve(Response.json(body,{status}))}));};return {reads,posts};}
async function mount(Component,props){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=async next=>act(async()=>root.render(React.createElement(Component,next)));await render(props);await settle();return {host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const done=async(req,body,status)=>{assert.ok(req);await act(async()=>req.done(body,status));await settle();};

test('queue shell and edited form retain DOM, dates and draft through refresh, error and week/Line context verification',async()=>{
 const net=network();const props={identity:'manager-C',planningDate:'2030-04-01',refresh:async()=>true};
 const {host,render,close}=await mount(Workspace,props);
 try{
  const shell=host.querySelector('[aria-label="Điều phối nhân sự"]');assert.ok(shell);assert.equal(shell.getAttribute('aria-busy'),'true');assert.equal(button(host,'Chờ phân bổ (0)').disabled,true);
  const toolbarButtons=['Chuyển nhân sự','Chờ phân bổ (0)','Hủy chuyển nhân sự','Lịch sử chuyển / hủy','Hướng dẫn'].map(label=>button(host,label));
  assert.equal(toolbarButtons.every(n=>n&&n.disabled),true,'all five controls exist together before permission/data verification');
  await done(net.reads.shift(),data());assert.equal(host.querySelector('[aria-label="Điều phối nhân sự"]'),shell);
  for(let i=0;i<toolbarButtons.length;i++)assert.equal(button(host,toolbarButtons[i].textContent.trim())===toolbarButtons[i],true,'first verification retains each real toolbar button');assert.doesNotMatch(shell.textContent,/Đang tải|Đang xác minh/);assert.equal(button(host,'Cập nhật dữ liệu'),undefined);
  await click(button(host,'Chuyển nhân sự'));
  const form=host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),reason=form.querySelector('[aria-label="Lý do chuyển nhân sự"]');
  await input(reason,'Giữ bản đang nhập');
  await input(form.querySelector('[aria-label="Đề nghị từ ngày giờ · ngày"]'),'2030-04-02');
  const beforeStart=form.querySelector('[name=offerStart]').value,beforeEnd=form.querySelector('[name=offerEnd]').value;
  await act(async()=>window.dispatchEvent(new Event('focus')));await settle();
  assert.equal(host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),form);assert.equal(form.querySelector('fieldset').disabled,false,'verified data stays usable during a background read');assert.doesNotMatch(shell.textContent,/Đang tải|Đang xác minh/);
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(net.posts.length,0);
  await done(net.reads.shift(),{error:'TEST refresh failed'},503);
  assert.equal(host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),form);assert.equal(reason.value,'Giữ bản đang nhập');assert.equal(form.querySelector('fieldset').disabled,true);
  for(const n of toolbarButtons)assert.equal(button(host,n.textContent.trim())===n,true,'failed read and retry action cannot replace the main controls');
  await click(button(host,'Cập nhật dữ liệu'));await done(net.reads.shift(),data(2));
  assert.equal(host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),form);assert.equal(form.querySelector('fieldset').disabled,false);
  await render({...props,planningDate:'2030-04-08',contextReady:false});await settle();
  assert.equal(host.querySelector('[aria-label="Điều phối nhân sự"]'),shell);assert.equal(host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),form);assert.equal(reason.value,'Giữ bản đang nhập');assert.doesNotMatch(shell.textContent,/Đang tải|Đang xác minh/);
  assert.equal(form.querySelector('[name=offerStart]').value,beforeStart);assert.equal(form.querySelector('[name=offerEnd]').value,beforeEnd);
  await done(net.reads.shift(),data(3));assert.equal(form.querySelector('fieldset').disabled,true,'capacity context still unverified');
  await render({...props,planningDate:'2030-04-08',contextReady:true});assert.equal(form.querySelector('fieldset').disabled,false);assert.equal(reason.value,'Giữ bản đang nhập');
  await render({...props,planningDate:'2030-04-15'});await settle();const old=net.reads.shift();
  await render({...props,planningDate:'2030-04-22'});await settle();await done(net.reads.shift(),data(4));
  await done(old,{error:'Stale denial'},403);assert.equal(host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),form);assert.equal(reason.value,'Giữ bản đang nhập');assert.equal(form.querySelector('fieldset').disabled,false);
  assert.equal(net.posts.length,0);
 }finally{await close();}
});

test('denial retains the outer shell, removes restricted data and blocks commands; identity change clears old drafts',async()=>{
 const net=network(),props={identity:'first',planningDate:'2030-04-01',refresh:async()=>true};const {host,render,close}=await mount(Workspace,props);
 try{
  const shell=host.querySelector('[aria-label="Điều phối nhân sự"]');await done(net.reads.shift(),data());await click(button(host,'Chuyển nhân sự'));
  await input(host.querySelector('[aria-label="Lý do chuyển nhân sự"]'),'Private old draft');
  await act(async()=>window.dispatchEvent(new Event('focus')));await settle();await done(net.reads.shift(),{error:'Tài khoản đã ngừng hoạt động.'},403);
  assert.equal(host.querySelector('[aria-label="Điều phối nhân sự"]'),shell);assert.match(host.querySelector('[role=alert]').textContent,/ngừng hoạt động/);assert.equal(host.querySelector('[aria-label="Gửi đề nghị nhân lực"]'),null);
  assert.equal(button(host,'Chờ phân bổ (0)').disabled,true);assert.equal(net.posts.length,0);
  await render({...props,identity:'second'});await settle();await done(net.reads.shift(),data());await click(button(host,'Chuyển nhân sự'));
  assert.equal(host.querySelector('[aria-label="Lý do chuyển nhân sự"]').value,'');
 }finally{await close();}
});

test('calendar mounts coordination immediately, before latest-week and capacity reads; loaded calendar keeps the same shell',async()=>{
 sync.clearClientReads('session');cache.clearCapacitySnapshots();const net=network();const {host,close}=await mount(Capacity,{view:'calendar',allocationIdentity:'calendar-manager'});
 try{
  const shell=host.querySelector('[aria-label="Điều phối nhân sự"]');assert.ok(shell);assert.match(host.textContent,/Lịch làm việc/);assert.match(host.textContent,/Đang tải tuần Capacity/);
  await done(net.reads.find(r=>r.path==='/api/production-allocation'),data());assert.equal(shell.getAttribute('aria-busy'),'true');
  await done(net.reads.find(r=>r.path.includes('latest=1')),{week:'2030-04-01'});
  await done(net.reads.filter(r=>r.path==='/api/production-allocation').at(-1),data(2));
  const capacity=net.reads.find(r=>r.path.includes('/api/capacity?week='));assert.ok(capacity);
  await done(capacity,{week:'2030-04-01',revision:1,rows:[],employees:[],legacy:[],permissions:{view:true,edit:false}});
  assert.equal(host.querySelector('[aria-label="Điều phối nhân sự"]'),shell);assert.equal(shell.getAttribute('aria-busy'),'false');assert.equal(net.posts.length,0);
 }finally{await close();sync.clearClientReads('session');cache.clearCapacitySnapshots();}
});

test('Save allocation keeps the same button and edited fields through six refresh/verification cycles and recoverable errors',async()=>{
 const net=network(),offer={id:'stable-incoming',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',effectiveAt:'2030-04-01T01:00:00Z',endsAt:'2030-04-01T10:00:00Z',canAllocate:true,canWithdraw:false,expired:false,people:[{id:'C1',name:'Nguyễn Hữu Lương',pending:[{effectiveAt:'2030-04-01T01:00:00Z',endsAt:'2030-04-01T10:00:00Z'}]}],allocations:[],withdrawals:[]};
 const queue={...data(),group:'AB',sourceLines:['A','B'],offers:[offer],pendingPeople:1};
 const props={identity:'stable-receiver',planningDate:'2030-04-01',refresh:async()=>true};
 const {host,render,close}=await mount(Workspace,props);
 try{
  await done(net.reads.shift(),queue);await click(button(host,'Chờ phân bổ (1)'));
  await click(host.querySelector('#allocation-pending tbody input'));
  const choose=button(host,'Lưu phân bổ (1)'),form=choose.closest('form'),target=form.querySelector('select');
  await act(async()=>{target.value='B';target.dispatchEvent(new Event('change',{bubbles:true}));});
  for(let cycle=0;cycle<6;cycle++){
   await render({...props,contextReady:false});
   assert.equal(button(host,'Lưu phân bổ (1)')===choose,true,'button must never be replaced by permission refresh');assert.equal(choose.disabled,true);assert.equal(choose.isConnected,true);
   await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   await act(async()=>window.dispatchEvent(new Event('focus')));await settle();
   assert.equal(button(host,'Lưu phân bổ (1)')===choose,true);assert.equal(form.querySelector('select'),target);assert.equal(target.value,'B');
   await done(net.reads.shift(),cycle===2?{error:'Temporary read error'}:{...queue,revision:cycle+2},cycle===2?503:200);
   assert.equal(button(host,'Lưu phân bổ (1)')===choose,true);assert.equal(target.value,'B');
   await render({...props,contextReady:true});assert.equal(choose.disabled,cycle===2);
  }
  assert.equal(net.posts.length,0);
  await act(async()=>window.dispatchEvent(new Event('focus')));await settle();await done(net.reads.shift(),{error:'Quyền đã bị thu hồi.'},403);
  assert.equal(button(host,'Lưu phân bổ (1)'),undefined,'real denial removes restricted personnel');
 }finally{await close();}
});

test('calendar saves allocation separately without a Capacity POST and stays editable after the fresh roster arrives',async()=>{
 sync.clearClientReads('session');cache.clearCapacitySnapshots();const net=network();const {newDailyCapacity}=await import('../lib/capacity.mjs');
 const rows=['A','B'].map(line=>{const r=newDailyCapacity('2030-04-01',line,95);r.input.dailyRoster=r.input.dailySchedule.map(d=>({date:d.date,hc:d.working&&line==='A'?['A1']:[],ot:[]}));return r;});
 const offer={id:'incoming-offer',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',effectiveAt:'2030-04-01T01:00:00Z',endsAt:'2030-04-01T10:00:00Z',canAllocate:true,canWithdraw:false,expired:false,people:[{id:'C1',name:'Nguyễn Hữu Lương',pending:[{effectiveAt:'2030-04-01T01:00:00Z',endsAt:'2030-04-01T10:00:00Z'}]}],allocations:[],withdrawals:[]};
 const queue={...data(),group:'AB',sourceLines:['A','B'],offers:[offer],pendingPeople:1};
 const calendar={week:'2030-04-01',revision:0,rows,employees:[{id:'A1',name:'Nhân viên A',line:'A',active:true},{id:'C1',name:'Nguyễn Hữu Lương',line:'C',active:true}],legacy:[],permissions:{view:true,edit:true,factor:true}};
 const {host,close}=await mount(Capacity,{view:'calendar',allocationIdentity:'independent-manager'});
 try{
  await done(net.reads.find(r=>r.path==='/api/production-allocation'),queue);
  await done(net.reads.find(r=>r.path.includes('latest=1')),{week:'2030-04-01'});
  await done(net.reads.filter(r=>r.path==='/api/production-allocation').at(-1),queue);
  await done(net.reads.find(r=>r.path.includes('/api/capacity?week=')),calendar);
  await click(button(host,'Chờ phân bổ (1)'));
  const readFetch=globalThis.fetch;globalThis.fetch=(path,init={})=>init.method==='POST'?(net.posts.push({path:String(path),body:JSON.parse(init.body)}),Promise.resolve(Response.json({action:'allocate',planning:true,allocationId:'allocation-test'}))):readFetch(path,init);
  await click(host.querySelector('#allocation-pending tbody input'));
  await click(button(host,'Lưu phân bổ (1)'));await settle();assert.equal(net.posts.length,1);assert.equal(net.posts[0].path,'/api/production-allocation');assert.equal(net.posts[0].body.action,'allocate-many');assert.equal(net.posts[0].body.inputs,undefined);
  const fresh=structuredClone(calendar);fresh.revision=1;fresh.rows[0].input.dailyRoster[0].hc.push('C1');
  await done(net.reads.filter(r=>r.path.includes('/api/capacity?week=')).at(-1),fresh);
  await done(net.reads.filter(r=>r.path==='/api/production-allocation').at(-1),{...queue,revision:2,offers:[],pendingPeople:0});
  assert.equal(host.querySelector('[aria-label="2030-04-01 HC bắt đầu"]').disabled,false);assert.equal(button(host,'Lưu nháp').disabled,false);assert.equal(button(host,'Bỏ chọn phân bổ'),undefined);assert.doesNotMatch(host.textContent,/Lưu nháp để lưu lịch và phân bổ cùng nhau/);assert.match(host.textContent,/tiếp tục chỉnh lịch làm việc/);
 }finally{await close();sync.clearClientReads('session');cache.clearCapacitySnapshots();}
});


test('verified cancellation stays enabled during six background reads; read failure and revocation still lock or clear it',async()=>{
 const net=network(),entry={id:'background-cancel',employeeId:'C1',targetLine:'A',effectiveAt:'2030-04-01T01:00:00Z',endsAt:'2030-04-01T10:00:00Z',planning:true,canCancel:true};
 const queue={...data(),group:'AB',sourceLines:['A','B'],offers:[{id:'background-offer',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',effectiveAt:entry.effectiveAt,endsAt:entry.endsAt,canAllocate:true,canWithdraw:false,expired:false,people:[{id:'C1',name:'Nguyễn Hữu Lương',pending:[]}],withdrawals:[],allocations:[entry]}]};
 const {host,close}=await mount(Workspace,{identity:'background-manager',planningDate:'2030-04-01',refresh:async()=>true});
 try{
  await done(net.reads.shift(),queue);await click(button(host,'Hủy chuyển nhân sự'));await click(button(host,'Hủy phân công'));
  const confirm=button(host,'Xác nhận hủy phân công'),reason=host.querySelector('[aria-label="Lý do hủy phân công"]');await input(reason,'Chọn lại Line');
  for(let i=0;i<6;i++){
   await act(async()=>window.dispatchEvent(new Event('focus')));await settle();assert.equal(confirm.disabled,false,'background refresh does not revoke a verified context');assert.equal(button(host,'Xác nhận hủy phân công')===confirm,true);assert.equal(reason.value,'Chọn lại Line');
   await done(net.reads.shift(),{...queue,revision:i+2});assert.equal(confirm.disabled,false);
  }
  await act(async()=>window.dispatchEvent(new Event('focus')));await settle();await done(net.reads.shift(),{error:'Mất kết nối kiểm tra quyền.'},503);assert.equal(confirm.disabled,true);assert.equal(reason.value,'Chọn lại Line');
  await click(button(host,'Cập nhật dữ liệu'));await done(net.reads.shift(),queue);assert.equal(confirm.disabled,false);
  await act(async()=>window.dispatchEvent(new Event('focus')));await settle();await done(net.reads.shift(),{error:'Quyền đã bị thu hồi.'},403);assert.equal(button(host,'Xác nhận hủy phân công'),undefined);assert.equal(net.posts.length,0);
 }finally{await close();}
});
