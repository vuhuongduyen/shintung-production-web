import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','localStorage'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:Queue}=await vite.ssrLoadModule('/components/production-allocation-queue.tsx');
const {ActionFeedbackHost}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close();});
const base={revision:0,group:'ADMIN',sourceLines:[],offers:[],pendingPeople:0,readOnly:true,configurationEnabled:false};
const button=(host,label)=>[...host.querySelectorAll('button')].find(node=>node.textContent.trim()===label);
const click=async node=>{assert.ok(node);await act(async()=>node.click());};
const selectCancellation=async host=>{const panel=host.querySelector('#allocation-outgoing'),select=panel.querySelector('[aria-label="Chọn phân công đã nhận cần hủy"]');if(select){await act(async()=>{select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));});return;}const trigger=panel.querySelector('[aria-label="Chọn nhân viên"]');if(trigger){await click(trigger);const checkbox=panel.querySelector('input[type=checkbox]');if(checkbox)await click(checkbox);}};
const settle=async()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,15));});
async function mount(view,onScopeSaved,onCommand=async()=>{throw Error('No allocation mutation allowed');},extra={}){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async(next=extra)=>act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(ActionFeedbackHost),React.createElement(Queue,{view,candidates:[],busy:false,onCommand,onScopeSaved,now:'2026-10-17T01:00:00Z',...next}))));
 await render();return {host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}

test('admin opens scope editor directly; saves only after second click and shows success only after matching readback',async()=>{
 for(const matches of [true,false]){
  let stored={enabled:false,managers:[]},posts=[],refreshes=0;
  globalThis.fetch=async(input,init={})=>{assert.equal(String(input),'/api/production-allocation-scope');if(init.method==='POST'){posts.push(JSON.parse(init.body));if(matches)stored={enabled:posts[0].enabled,managers:posts[0].managers};return Response.json({ok:true});}return Response.json({revision:'r1',configuration:stored,users:[{id:'test-c',name:'Synthetic C',eligible:true},{id:'test-ab',name:'Synthetic AB',eligible:true}]});};
  const {host,close}=await mount(base,async()=>{refreshes++;});
  try{
   assert.equal(host.querySelector('#allocation-help').hidden,true);assert.equal(host.querySelector('#allocation-pending').hidden,true);assert.equal(button(host,'Chuyển nhân sự').disabled,true);assert.equal(button(host,'Hủy chuyển nhân sự').disabled,true);assert.equal(host.querySelectorAll('select').length,0);
   await click(button(host,'Thiết lập QLSX'));await settle();assert.equal(host.querySelector('#allocation-setup').hidden,false);
   const selects=host.querySelectorAll('select');assert.equal(selects.length,2);
   await act(async()=>{selects[0].value='test-c';selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value='test-ab';selects[1].dispatchEvent(new Event('change',{bubbles:true}));});
   await click(host.querySelector('input[type=checkbox]'));await click(button(host,'Lưu phạm vi Chờ phân bổ'));assert.equal(posts.length,0);
   assert.equal(button(host,'Áp dụng quyền'),undefined);await click(button(host,'Xác nhận lưu phạm vi'));await settle();assert.equal(posts.length,1);assert.equal(posts[0].expectedRevision,'r1');assert.deepEqual(posts[0].managers,[{userId:'test-c',group:'C'},{userId:'test-ab',group:'AB'}]);
   if(matches){assert.match(host.querySelector('[role=status]').textContent,/Đã lưu phạm vi QLSX và kiểm tra lại thành công/);assert.equal(refreshes,1);}
   else{assert.match(host.querySelector('section[role=alert]').textContent,/xác minh việc lưu phạm vi QLSX/);assert.equal(host.querySelector('[role=status]'),null);assert.match(host.querySelector('#allocation-setup [role=alert]').textContent,/đọc lại không khớp/);assert.equal(refreshes,0);assert.equal(host.querySelectorAll('select')[0].value,'test-c');assert.equal(host.querySelectorAll('select')[1].value,'test-ab');assert.equal(host.querySelector('input[type=checkbox]').checked,true);}
  }finally{await close();}
 }
});

test('manager practical buttons reveal send or queue, never scope editor',async()=>{
 let reads=0;globalThis.fetch=async()=>{reads++;throw Error('Manager must not read setup');};
 const {host,close}=await mount({...base,group:'C',sourceLines:['C'],readOnly:false},async()=>{});
 try{assert.equal(button(host,'Thiết lập QLSX'),undefined);assert.equal(host.querySelector('#allocation-send').hidden,true);await click(button(host,'Chuyển nhân sự'));assert.equal(host.querySelector('#allocation-send').hidden,false);assert.match(host.querySelector('#allocation-send').textContent,/Nhóm nhận: QLSX Line A\/B/);await click(button(host,'Chờ phân bổ (0)'));assert.equal(host.querySelector('#allocation-send').hidden,true);assert.equal(host.querySelector('#allocation-pending').hidden,false);assert.equal(reads,0);await click(button(host,'Hủy chuyển nhân sự'));await selectCancellation(host);assert.equal(host.querySelector('#allocation-outgoing').hidden,false);assert.match(host.querySelector('#allocation-outgoing').textContent,/Không có lượt phân công được phép hủy/);}finally{await close();}
});


test('scope readback failures get a safe floating notice; POST denial is deduplicated and pending confirmation cannot resubmit',async()=>{
 for(const mode of ['readback-http','readback-network','post-denied','readback-mismatch-after-busy']){
  let posts=0,reads=0,refreshes=0,finish;
  const notices=[];const receive=event=>notices.push(event.detail.message);window.addEventListener('onspa-action-feedback',receive);
  globalThis.fetch=async(input,init={})=>{
   assert.equal(String(input),'/api/production-allocation-scope');
   if(init.method==='POST'){posts++;await new Promise(resolve=>finish=resolve);return mode==='post-denied'?Response.json({error:'private SQL token'}, {status:403}):Response.json({ok:true});}
   reads++;
   if(reads>1){if(mode==='readback-mismatch-after-busy')return Response.json({revision:'r2',configuration:{enabled:true,managers:[]},users:[]});if(mode==='readback-network')throw Error('private SQL token');return Response.json({error:'private SQL token'},{status:500});}
   return Response.json({revision:'r1',configuration:{enabled:false,managers:[]},users:[]});
  };
  const {host,close}=await mount(base,async()=>{refreshes++;});
  try{
   await click(button(host,'Thiết lập QLSX'));await settle();
   await click(button(host,'Lưu phạm vi Chờ phân bổ'));assert.equal(posts,0);
   await click(button(host,'Xác nhận lưu phạm vi'));assert.equal(posts,1);
   const confirm=button(host,'Xác nhận lưu phạm vi');assert.equal(confirm.disabled,true);await click(confirm);assert.equal(posts,1);
   if(mode==='readback-mismatch-after-busy'||mode==='post-denied'){await click(confirm.parentElement);assert.equal(posts,1);assert.match(notices[0],/Đang xử lý/);}
   await act(async()=>finish());await settle();
   assert.equal(notices.length,mode==='readback-mismatch-after-busy'||mode==='post-denied'?2:1);const failure=notices.at(-1);assert.doesNotMatch(failure,/private|SQL|token|Đang xử lý/);
   assert.match(failure,mode==='post-denied'?/không có quyền/:/xác minh việc lưu phạm vi QLSX/);
   assert.equal(host.querySelector('section[role=alert]').textContent.includes(failure),true);
   assert.equal(host.querySelector('[role=status]'),null);assert.equal(refreshes,0);
   assert.equal(button(host,'Xác nhận lưu phạm vi').disabled,false);
  }finally{window.removeEventListener('onspa-action-feedback',receive);await close();}
 }
});


test('receiver cancellation opens explicit reason confirmation and retains durable visible history',async()=>{
 const entry={id:'allocation-test',employeeId:'c1',targetLine:'A',effectiveAt:'2026-10-19T01:00:00Z',endsAt:'2026-10-19T10:00:00Z',planning:true,canCancel:true,actorId:'receiver',recordedAt:'2026-10-17T01:00:00Z'};
 const offer={id:'offer-test',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',effectiveAt:entry.effectiveAt,endsAt:entry.endsAt,canAllocate:true,canWithdraw:false,expired:false,reason:'C chưa có việc',createdBy:'sender',createdAt:'2026-10-17T00:00:00Z',people:[{id:'c1',name:'Synthetic person',pending:[]}],withdrawals:[],allocations:[entry]};
 const commands=[],v={...base,revision:9,group:'AB',sourceLines:['A','B'],readOnly:false,offers:[offer]};
 const {host,close}=await mount(v,undefined,async command=>{commands.push(command);return true;});
 try{
  await click(button(host,'Lịch sử chuyển / hủy'));assert.match(host.querySelector('#allocation-history').textContent,/C chưa có việc/);assert.match(host.querySelector('#allocation-history').textContent,/17\/10\/2026 07:00/);
  assert.equal(host.querySelector('#allocation-outgoing').hidden,true);
  assert.equal(host.querySelector('#allocation-history [aria-label="Hủy phân công kế hoạch"]'),null);
  assert.match(button(host,'Hủy chuyển nhân sự').className,/danger/);
  await click(button(host,'Hủy chuyển nhân sự'));await selectCancellation(host);assert.equal(host.querySelector('#allocation-outgoing').hidden,false);assert.equal(host.querySelector('#allocation-history').hidden,true);assert.match(button(host,'Hủy phân công').className,/danger/);
  await click(button(host,'Hủy phân công'));assert.equal(commands.length,0);
  const form=host.querySelector('[aria-label="Hủy phân công kế hoạch"]');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(commands.length,0);
  const reason=host.querySelector('[aria-label="Lý do hủy phân công"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(reason,'Đổi lịch');reason.dispatchEvent(new Event('input',{bubbles:true}));});
  await click(button(host,'Xác nhận hủy phân công'));assert.equal(commands.length,1);assert.equal(commands[0].action,'cancel');assert.equal(commands[0].allocationId,'allocation-test');assert.equal(commands[0].reason,'Đổi lịch');assert.equal(commands[0].expectedRevision,9);assert.equal(commands[0].effectiveAt,undefined);
 }finally{await close();}
 for(const readOnly of [false,true]){
  const {host,close}=await mount({...v,group:readOnly?'ADMIN':'C',readOnly,offers:[{...offer,allocations:[{...entry,canCancel:readOnly,canceled:!readOnly,canceledBy:'receiver',canceledAt:'2026-10-17T01:00:00Z',cancellationReason:'Đổi lịch'}]}]});
  try{assert.equal(button(host,'Hủy phân công'),undefined);if(!readOnly){assert.match(host.textContent,/Đã hủy phân công/);assert.match(host.textContent,/Đổi lịch/);}}finally{await close();}
 }
});


test('sender cancellation panel uses only existing pending withdrawal and excludes received allocations without cancel permission',async()=>{
 const offer={id:'offer-sender',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',effectiveAt:'2026-10-19T01:00:00Z',endsAt:'2026-10-19T10:00:00Z',canAllocate:false,canWithdraw:true,expired:false,people:[{id:'c1',name:'Synthetic sender',pending:[{effectiveAt:'2026-10-19T01:00:00Z',endsAt:'2026-10-19T10:00:00Z'}]}],withdrawals:[],allocations:[{id:'cannot-cancel',employeeId:'c1',planning:true,canCancel:true}]};
 const {host,close}=await mount({...base,group:'C',sourceLines:['C'],readOnly:false,offers:[offer]});
 try{await click(button(host,'Hủy chuyển nhân sự'));await selectCancellation(host);assert.ok(button(host,'Hủy chuyển (1)'));assert.equal(button(host,'Hủy phân công'),undefined);assert.ok(host.querySelector('[aria-label="Lý do hủy chuyển nhân sự"]'));}finally{await close();}
 const received={...offer,sourceGroup:'AB',targetGroup:'C',canWithdraw:false,people:[],allocations:[{...offer.allocations[0],canCancel:false}]};
 const denied=await mount({...base,group:'C',sourceLines:['C'],readOnly:false,offers:[received]});
 try{await click(button(denied.host,'Hủy chuyển nhân sự'));assert.equal(button(denied.host,'Hủy phân công'),undefined);assert.match(denied.host.querySelector('#allocation-outgoing').textContent,/Không có lượt phân công được phép hủy/);}finally{await denied.close();}
});


test('allocation error notice expires after four seconds while retry details and verification guards remain',async()=>{
 const original=window.setTimeout,callbacks=[];let calls=0;
 window.setTimeout=(callback,delay,...args)=>{if(delay===4000){callbacks.push(callback);return 987654;}return original.call(window,callback,delay,...args);};
 const {host,close}=await mount({...base,group:'C',sourceLines:['C'],readOnly:false},undefined,async()=>{calls++;return true;},{verified:false,statusError:true,status:'Chưa tải được dữ liệu mới. Thử tải lại.',onReload:async()=>{}});
 try{
  assert.ok(host.querySelector('section[role="alert"]'));assert.equal(callbacks.length,1);
  await act(async()=>callbacks[0]());assert.equal(host.querySelector('section[role="alert"]'),null);
  assert.match(button(host,'Cập nhật dữ liệu').title,/Chưa tải được dữ liệu mới/);assert.equal(button(host,'Chuyển nhân sự').disabled,true);
  const form=host.querySelector('[aria-label="Gửi đề nghị nhân lực"]');await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls,0);
 }finally{await close();window.setTimeout=original;}
});


test('open cancellation confirmation and typed reason survive six verification cycles without replacing the confirm button',async()=>{
 const entry={id:'stable-cancel',employeeId:'C1',targetLine:'A',effectiveAt:'2026-10-26T01:00:00Z',endsAt:'2026-10-26T10:00:00Z',planning:true,canCancel:true};
 const offer={id:'stable-offer',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',effectiveAt:entry.effectiveAt,endsAt:entry.endsAt,canAllocate:true,canWithdraw:false,expired:false,people:[{id:'C1',name:'Nguyễn Hữu Lương',pending:[]}],allocations:[entry],withdrawals:[]};
 let calls=0;const {host,render,close}=await mount({...base,group:'AB',sourceLines:['A','B'],readOnly:false,offers:[offer]},undefined,async()=>{calls++;return true;});
 try{
  await click(button(host,'Hủy chuyển nhân sự'));await selectCancellation(host);await click(button(host,'Hủy phân công'));
  const confirm=button(host,'Xác nhận hủy phân công'),form=confirm.closest('form'),reason=form.querySelector('input');assert.equal(confirm.disabled,true);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(reason,'Đổi Line nhận');reason.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(confirm.disabled,false);
  for(let i=0;i<6;i++){
   await render({verified:false});assert.equal(button(host,'Xác nhận hủy phân công')===confirm,true);assert.equal(confirm.closest('form')===form,true);assert.equal(reason.value,'Đổi Line nhận');assert.equal(confirm.disabled,true);
   await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls,0);
   await render({verified:true});assert.equal(button(host,'Xác nhận hủy phân công')===confirm,true);assert.equal(confirm.disabled,false);assert.equal(reason.value,'Đổi Line nhận');
  }
 }finally{await close();}
});

test('writable Admin operates both sides with separate allocate/withdraw forms, correct receiving Lines and all source Lines',async()=>{
 const span={effectiveAt:'2026-10-19T01:00:00Z',endsAt:'2026-10-19T10:00:00Z'};
 const make=(id,line,employee)=>({id,sourceLine:line,sourceGroup:line==='C'?'C':'AB',targetGroup:line==='C'?'AB':'C',...span,canAllocate:true,canWithdraw:true,expired:false,people:[{id:employee,name:employee,pending:[span]}],allocations:[],withdrawals:[]});
 const v={...base,group:'ADMIN',sourceLines:['A','B','C'],readOnly:false,configurationEnabled:true,offers:[make('offer-c','C','C One'),make('offer-a','A','A One')]},commands=[];
 const {host,close}=await mount(v,undefined,async body=>{commands.push(body);return true;});try{
  await click(button(host,'Chuyển nhân sự'));assert.deepEqual([...host.querySelector('[aria-label="Line nguồn"]').options].map(x=>x.value),['A','B','C']);assert.equal(button(host,'Chuyển nhân sự').disabled,false);assert.ok(button(host,'Thiết lập QLSX'));
  await click(button(host,'Chờ phân bổ (2)'));const pending=host.querySelector('#allocation-pending');assert.equal(pending.querySelector('select'),null);
  await click(pending.querySelector('tbody input'));assert.deepEqual([...pending.querySelector('select').options].map(x=>x.value),['A','B']);assert.equal(pending.querySelector('[aria-label="Lý do hủy chuyển nhân sự"]'),null);
  const accept=pending.querySelector('form');await act(async()=>accept.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(commands.length,1);assert.equal(commands[0].action,'allocate-many');assert.equal(commands[0].targetLine,'A');
  await click(pending.querySelectorAll('tbody input')[1]);assert.deepEqual([...pending.querySelector('select').options].map(x=>x.value),['C']);
  await click(button(host,'Hủy chuyển nhân sự'));await selectCancellation(host);const outgoing=host.querySelector('#allocation-outgoing'),form=outgoing.querySelector('form'),reason=form.querySelector('[aria-label="Lý do hủy chuyển nhân sự"]');assert.ok(reason);assert.equal(form.querySelector('select'),null);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(reason,'Đổi kế hoạch');reason.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(commands.length,2);assert.equal(commands[1].action,'withdraw-many');assert.equal(commands[1].reason,'Đổi kế hoạch');assert.equal(commands[1].targetLine,undefined);
 }finally{await close();}
});

test('batch withdrawal selects people first and submits one shared time window',async()=>{
 const span={effectiveAt:'2026-10-26T01:00:00Z',endsAt:'2026-10-30T10:00:00Z'};
 const offer={id:'batch-offer',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',...span,canWithdraw:true,canAllocate:false,expired:false,people:[{id:'S2008007',name:'Nguyễn Hữu Lương',pending:[span]},{id:'S2017002',name:'Trần Thuận Phát',pending:[span]}],allocations:[],withdrawals:[]};
 const calls=[];const m=await mount({...base,readOnly:false,group:'C',sourceLines:['C'],offers:[offer]},undefined,async c=>{calls.push(c);return true;});
 try{await click(button(m.host,'Hủy chuyển nhân sự'));const panel=m.host.querySelector('#allocation-outgoing');assert.equal(panel.querySelector('input[type=date]'),null);
 await click(panel.querySelector('[aria-label="Chọn nhân viên"]'));const checks=[...panel.querySelectorAll('input[type=checkbox]')];assert.equal(checks.length,2);await click(checks[0]);await click(checks[1]);
 assert.equal(panel.querySelectorAll('input[type=date]').length,2);
 const reason=panel.querySelector('[aria-label="Lý do hủy chuyển nhân sự"]');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(reason,'Đổi lịch');reason.dispatchEvent(new Event('input',{bubbles:true}));});
 await click(button(panel,'Hủy chuyển (2)'));assert.equal(calls.length,1);assert.equal(calls[0].action,'withdraw-many');assert.equal(calls[0].selections.length,2);assert.equal(calls[0].effectiveAt,'2026-10-26T01:00:00.000Z');assert.equal(calls[0].endsAt,'2026-10-30T10:00:00.000Z');assert.equal(panel.querySelector('input[type=date]'),null);
 }finally{await m.close();}
});
