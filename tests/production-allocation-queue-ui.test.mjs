import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {default:Queue}=await vite.ssrLoadModule('/components/production-allocation-queue.tsx');
const now='2026-10-16T01:00:00Z';
const window={effectiveAt:'2026-10-16T02:00:00Z',endsAt:'2026-10-16T05:00:00Z'};
const offer={id:'offer-1',sourceLine:'C',sourceGroup:'C',targetGroup:'AB',...window,canAllocate:true,canWithdraw:false,expired:false,people:[{id:'c1',name:'Ngọc',pending:[window]}],allocations:[],withdrawals:[]};
const view={revision:7,group:'AB',sourceLines:['A','B'],offers:[offer],pendingPeople:1};
const base={view,candidates:[{id:'a1',name:'An',line:'A'},{id:'b1',name:'Bình',line:'B'},{id:'c2',name:'Ngoài phạm vi',line:'C'}],busy:false,onCommand:async()=>true,now};
const render=props=>renderToStaticMarkup(React.createElement(Queue,{...base,...props}));
function flatten(node){if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(flatten);return [node,...flatten(node.props?.children)];}
// A minimal synchronous hook harness invokes the actual form callbacks without a DOM.
function harness(Component,props){
 const states=[];let index=0;
 const hooks={useEffect(){},useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef(initial){const i=index++;if(!(i in states))states[i]={current:initial};return states[i];}};
 return {render(){index=0;const internals=React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,previous=internals.H;try{internals.H=hooks;return Component(props);}finally{internals.H=previous;}},states};
}
const node=(tree,predicate)=>flatten(tree).find(predicate);
const input=(tree,label)=>{const n=node(tree,n=>n.props?.['aria-label']===label||n.props?.label===label);return n?.props?.label?{...n,props:{...n.props,onChange:event=>n.props.onChange(event.target.value)}}:n;};
const picker=tree=>node(tree,n=>typeof n.type==='function'&&Array.isArray(n.props.candidates)&&Array.isArray(n.props.selected));
const submit=tree=>node(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});

test('compact queue is collapsed, displays unique pending badge, GMT+7 and only offered incoming names',()=>{
 const html=render();assert.match(html,/<section class="production-allocation-queue /);assert.doesNotMatch(html,/<details[^>]* open/);
 assert.match(html,/Chờ phân bổ/);assert.match(html,/1 người đang chờ nhận/);assert.match(html,/Ngọc/);assert.match(html,/16\/10\/2026 09:00/);assert.match(html,/Chọn Ngọc/);
 assert.match(html,/Chưa ghi nhận giờ công thực tế/);assert.match(html,/GMT\+7/);assert.doesNotMatch(html,/Ngoài phạm vi|Bình/);
 assert.doesNotMatch(html,/Line nhận cho nhân viên đã chọn/);
});

test('scope C permits only C source and target, sender can withdraw pending subwindows only',()=>{
 const outgoing={...offer,canAllocate:false,canWithdraw:true,people:[{id:'c1',name:'Ngọc',pending:[{effectiveAt:'2026-10-16T03:00:00Z',endsAt:window.endsAt}]}]};
 const incoming={...offer,id:'offer-2',sourceLine:'A',sourceGroup:'AB',targetGroup:'C',people:[{id:'a9',name:'Hà',pending:[window]}]};
 const html=render({view:{...view,group:'C',sourceLines:['C'],offers:[outgoing,incoming]},candidates:[{id:'c2',name:'Cúc',line:'C'},{id:'a2',name:'Không được chọn',line:'A'}]});
 assert.match(html,/Chọn Hà/);assert.match(html,/Hủy chuyển nhiều nhân viên/);assert.match(html,/Ngọc/);assert.match(html,/min="2026-10-16"/);assert.doesNotMatch(html,/Line nhận cho nhân viên đã chọn/);
 assert.doesNotMatch(html,/Phân bổ Ngọc|Rút Hà|Không được chọn|value="A"/);assert.match(html,/Chọn nhân viên/);
});

test('expired, fully allocated, unrelated and unconfigured scopes offer no mutation controls',()=>{
 const props={view:{...view,offers:[{...offer,expired:true},{...offer,id:'done',people:[{id:'done',name:'Đã nhận hết',pending:[]}]},{...offer,id:'wrong',targetGroup:'C',sourceGroup:'C',people:[{id:'wrong',name:'Sai phạm vi',pending:[window]}]}]}};const html=render(props);
 assert.match(html,/0 người đang chờ nhận/);assert.match(html,/Chưa có nhân lực chờ nhận/);assert.doesNotMatch(html,/Phân bổ Ngọc|Sai phạm vi/);const history=flatten(harness(Queue,{...base,...props}).render()).filter(n=>n.type==='dd').map(n=>renderToStaticMarkup(n)).join('');assert.match(history,/Đã nhận hết/,'completed people remain in history behind the dialog');assert.doesNotMatch(history,/Sai phạm vi/);
 for(const missing of [{...view,group:'unknown'},{...view,sourceLines:[]}]){const text=render({view:missing});assert.match(text,/role="alert"/);assert.match(text,/Chưa được thiết lập phạm vi QLSX/);assert.doesNotMatch(text,/<form/);}
});

test('busy UI disables source picker, names and pending-window actions',()=>{
 const html=render({busy:true});assert.match(html,/<fieldset disabled=""/);assert.match(html,/<input[^>]*aria-label="Chọn Ngọc[^>]*disabled/);assert.match(html,/<button[^>]*disabled=""[^>]*>Chuyển nhân sự/);

});

test('sending uses explicit names, source scope and revision; failed retry retains edits and request id',async()=>{
 const commands=[];let success=false;
 const h=harness(Queue,{...base,onCommand:async command=>{commands.push(command);return success;}});
 let tree=h.render();picker(tree).props.onChange(['a1']);input(tree,'Lý do chuyển nhân sự').props.onChange({target:{value:'Đổi kế hoạch'}});
 input(tree,'Đề nghị đến ngày giờ').props.onChange({target:{value:'2026-10-16T10:00:00'}});
 tree=h.render();await node(tree,n=>n.type==='form'&&n.props['aria-label']==='Gửi đề nghị nhân lực').props.onSubmit({preventDefault(){}});
 tree=h.render();assert.deepEqual(picker(tree).props.selected,['a1']);assert.equal(input(tree,'Đề nghị đến ngày giờ').props.value,'2026-10-16T10:00:00');
 await node(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(commands.length,2);assert.equal(commands[0].requestId,commands[1].requestId);
 assert.deepEqual(commands[0].employees,['a1']);assert.equal(commands[0].expectedRevision,7);assert.equal(commands[0].sourceLine,'A');assert.equal(commands[0].effectiveAt,new Date(now).toISOString());assert.equal(commands[0].endsAt,'2026-10-16T03:00:00.000Z');assert.equal(commands[0].action,'offer');assert.ok(commands[0].requestId.length>=16);
 success=true;await submit(h.render());tree=h.render();assert.equal(input(tree,'Đề nghị đến ngày giờ').props.value,'2026-10-16T10:00:00');assert.deepEqual(picker(tree).props.selected,[]);
});

test('allocation submits only one offered person and selected bounded interval; rejects out-of-window input',async()=>{
 const queue=harness(Queue,base).render();const child=node(queue,n=>n.type?.name==='ProductionAllocationSelection');const commands=[];
 const h=harness(child.type,{...child.props,onCommand:async command=>{commands.push(command);return false;}});
 let tree=h.render();node(tree,n=>n.type==='input'&&n.props['aria-label']==='Chọn Ngọc (c1)').props.onChange({target:{checked:true}});tree=h.render();input(tree,'Line nhận cho nhân viên đã chọn').props.onChange({target:{value:'B'}});input(tree,'Phân bổ từ ngày giờ').props.onChange({target:{value:'2026-10-16T10:00:00'}});input(tree,'Phân bổ đến ngày giờ').props.onChange({target:{value:'2026-10-16T11:00:00'}});
 await submit(h.render());assert.equal(commands.length,1);assert.equal(commands[0].selections[0].employeeId,'c1');assert.equal(commands[0].targetLine,'B');assert.equal(commands[0].effectiveAt,'2026-10-16T03:00:00.000Z');assert.equal(commands[0].endsAt,'2026-10-16T04:00:00.000Z');assert.equal(commands[0].expectedRevision,7);assert.equal(commands[0].action,'allocate-many');
 tree=h.render();assert.equal(input(tree,'Phân bổ từ ngày giờ').props.value,'2026-10-16T10:00:00');input(tree,'Phân bổ đến ngày giờ').props.onChange({target:{value:'2026-10-16T14:00:00'}});await submit(h.render());assert.equal(commands.length,1);
});

test('withdrawal is a selected pending subwindow, never a whole-offer cancellation',async()=>{
 const queue=harness(Queue,{...base,view:{...view,group:'C',sourceLines:['C'],offers:[{...offer,canAllocate:false,canWithdraw:true}]}}).render();
 const child=node(queue,n=>n.type?.name==='WithdrawMany');assert.ok(child);const commands=[];const h=harness(child.type,{...child.props,onCommand:async command=>{commands.push(command);return true;}});
 let tree=h.render();await submit(tree);assert.equal(commands.length,0,'selection is required');picker(tree).props.onChange(['c1']);tree=h.render();
 input(tree,'Lý do hủy chuyển nhân sự').props.onChange({target:{value:'Đổi kế hoạch'}});input(tree,'Hủy chuyển từ ngày giờ').props.onChange({target:{value:'2026-10-16T10:00:00'}});input(tree,'Hủy chuyển đến ngày giờ').props.onChange({target:{value:'2026-10-16T14:00:00'}});await submit(h.render());assert.equal(commands.length,0,'out-of-window withdrawal is rejected');
 input(h.render(),'Hủy chuyển đến ngày giờ').props.onChange({target:{value:'2026-10-16T11:00:00'}});await submit(h.render());
 assert.equal(commands.length,1);assert.equal(commands[0].action,'withdraw-many');assert.deepEqual(commands[0].selections,[{offerId:'offer-1',employeeId:'c1'}]);assert.equal(commands[0].expectedRevision,7);assert.equal(commands[0].reason,'Đổi kế hoạch');assert.equal(commands[0].targetLine,undefined);assert.equal(commands[0].effectiveAt,'2026-10-16T03:00:00.000Z');assert.equal(commands[0].endsAt,'2026-10-16T04:00:00.000Z');

});

test('component owns no network, global roster, attendance or toolbar implementation',async()=>{
 const source=await readFile(new URL('../components/production-allocation-queue.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|\/api\/|localStorage|attendance-override|line-movement|className="[^"]*toolbar/);
 assert.match(source,/productionRequestId/);assert.match(source,/expectedRevision:view.revision/);assert.match(source,/if\(ok\)\{setSelected\(\[\]\)/);
});

test('changing source clears selected names and rejects empty or backwards intervals',async()=>{
 const commands=[];const h=harness(Queue,{...base,onCommand:async command=>{commands.push(command);return true;}});
 let tree=h.render();picker(tree).props.onChange(['a1']);input(tree,'Lý do chuyển nhân sự').props.onChange({target:{value:'Đổi kế hoạch'}});input(tree,'Đề nghị đến ngày giờ').props.onChange({target:{value:'2026-10-16T07:00:00'}});
 await submit(h.render());assert.equal(commands.length,0);
 input(tree,'Line nguồn').props.onChange({target:{value:'B'}});tree=h.render();assert.deepEqual(picker(tree).props.selected,[]);assert.deepEqual(picker(tree).props.candidates.map(p=>p.name),['Bình']);assert.doesNotMatch(renderToStaticMarkup(tree),/Ngoài phạm vi/);
 input(tree,'Đề nghị đến ngày giờ').props.onChange({target:{value:'2026-10-16T10:00:00'}});await submit(h.render());assert.equal(commands.length,0);
});

test('in-flight duplicate submits are blocked and thrown failures retain the draft',async()=>{
 let resolve;const commands=[];const h=harness(Queue,{...base,onCommand:command=>{commands.push(command);return new Promise(r=>resolve=r);}});
 let tree=h.render();picker(tree).props.onChange(['a1']);input(tree,'Lý do chuyển nhân sự').props.onChange({target:{value:'Đổi kế hoạch'}});input(tree,'Đề nghị đến ngày giờ').props.onChange({target:{value:'2026-10-16T10:00:00'}});
 tree=h.render();const first=submit(tree);await submit(tree);assert.equal(commands.length,1);resolve(false);await first;assert.equal(input(h.render(),'Đề nghị đến ngày giờ').props.value,'2026-10-16T10:00:00');
 const throwing=harness(Queue,{...base,onCommand:async()=>{throw Error('Server error handled by parent');}});tree=throwing.render();picker(tree).props.onChange(['a1']);input(tree,'Lý do chuyển nhân sự').props.onChange({target:{value:'Đổi kế hoạch'}});input(tree,'Đề nghị đến ngày giờ').props.onChange({target:{value:'2026-10-16T10:00:00'}});await submit(throwing.render());assert.equal(input(throwing.render(),'Đề nghị đến ngày giờ').props.value,'2026-10-16T10:00:00');
});

test('fractional pending start is rounded forward after selecting an employee',()=>{
 const queue=harness(Queue,{...base,view:{...view,offers:[{...offer,people:[{id:'c1',name:'Ngọc',pending:[{...window,effectiveAt:'2026-10-16T02:00:00.123Z'}]}]}]}}).render();
 const child=node(queue,n=>n.type?.name==='ProductionAllocationSelection'),h=harness(child.type,child.props);let tree=h.render();node(tree,n=>n.type==='input'&&n.props['aria-label']==='Chọn Ngọc (c1)').props.onChange({target:{checked:true}});tree=h.render();assert.equal(input(tree,'Phân bổ từ ngày giờ').props.value,'2026-10-16T09:01');
});

test('admin sees offers, pending names and setup control without allocation forms',()=>{
 const html=render({view:{...view,group:'ADMIN',sourceLines:[],readOnly:true,configurationEnabled:false,offers:[{...offer,canAllocate:false,canWithdraw:false}]},candidates:[]});
 for(const label of ['Điều phối nhân sự','Chuyển nhân sự','Chờ phân bổ','Ngọc','Chờ phân bổ · Chỉ xem','Chưa bật cấu hình điều phối','Thiết lập QLSX'])assert.ok(html.includes(label),label);
 assert.doesNotMatch(html,/<form|<input|<select/);assert.match(html,/<button[^>]*aria-controls="allocation-send"[^>]*disabled=""/);
});

test('planning allocations and old actual records remain distinct and unconverted',()=>{
 const allocations=[{id:'planned',employeeId:'c1',targetLine:'A',...window,planning:true},{id:'old',employeeId:'c1',targetLine:'B',...window}],before=structuredClone(allocations);
 const tree=harness(Queue,{...base,view:{...view,offers:[{...offer,allocations}]}}).render();
 const planned=node(tree,n=>n.type==='tr'&&n.key==='aplanned'),actual=node(tree,n=>n.type==='tr'&&n.key==='aold');assert.ok(planned);assert.ok(actual);
 assert.match(renderToStaticMarkup(planned),/Phân bổ nhân sự \(kế hoạch\)/);assert.match(renderToStaticMarkup(actual),/Phân bổ nhân sự \(thực tế\)/);assert.deepEqual(allocations,before,'rendering history cannot convert old actual records');

});

test('multi-day allocation preserves full reservation; UI explains planned shift intersection',async()=>{
 const extended={...offer,endsAt:'2026-10-20T10:00:00Z',people:[{id:'c1',name:'Ngọc',pending:[{effectiveAt:window.effectiveAt,endsAt:'2026-10-20T10:00:00Z'}]}]};
 const queue=harness(Queue,{...base,view:{...view,offers:[extended]}}).render(),child=node(queue,n=>n.type?.name==='ProductionAllocationSelection'),commands=[];
 const h=harness(child.type,{...child.props,onCommand:async command=>{commands.push(command);return false;}});
 let tree=h.render();node(tree,n=>n.type==='input'&&n.props['aria-label']==='Chọn Ngọc (c1)').props.onChange({target:{checked:true}});tree=h.render();input(tree,'Phân bổ đến ngày giờ').props.onChange({target:{value:'2026-10-19T17:00'}});await submit(h.render());assert.equal(commands.length,1);assert.equal(commands[0].endsAt,'2026-10-19T10:00:00.000Z');
 const html=render();assert.match(html,/toàn bộ khoảng đề nghị được giữ chỗ/);assert.match(html,/ca HC\/TC từng ngày/);assert.match(html,/không tính giờ nghỉ trưa/);assert.match(html,/lịch nháp/);assert.match(html,/lịch đã chốt hoặc đang khóa/);assert.doesNotMatch(html,/type="datetime-local"/);
 tree=h.render();input(tree,'Phân bổ đến ngày giờ').props.onChange({target:{value:'2026-10-19T17:00:01'}});await submit(h.render());assert.equal(commands.length,1);
});

test('real toolbar actions expand practical panels while keeping help and forms hidden initially',()=>{
 const h=harness(Queue,base);let tree=h.render();
 const panel=(name)=>node(tree,n=>n.props?.id===`allocation-${name}`);
 for(const name of ['send','pending','help'])assert.equal(panel(name).props.hidden,true);
 const click=(name)=>{const toolbar=node(tree,n=>n.type?.name==='StandardToolbar');toolbar.props.items.find(item=>item?.props?.['aria-controls']===`allocation-${name}`).props.onClick();tree=h.render();};
 click('send');assert.equal(panel('send').props.hidden,false);assert.equal(panel('pending').props.hidden,true);assert.equal(panel('help').props.hidden,true);
 assert.ok(node(panel('send'),n=>n.type==='form'));assert.match(renderToStaticMarkup(panel('send')),/Nhóm nhận:.*QLSX Line C/);
 click('pending');assert.equal(panel('pending').props.hidden,false);assert.equal(panel('send').props.hidden,true);
 click('pending');assert.equal(panel('pending').props.hidden,true);
 const html=render();assert.match(html,/data-standard-toolbar="Điều phối nhân sự"/);assert.match(html,/aria-controls="allocation-send"/);assert.match(html,/aria-controls="allocation-pending"/);
});

test('admin setup opens dedicated scope editor; sender actions stay visible but disabled',()=>{
 const h=harness(Queue,{...base,view:{...view,group:'ADMIN',sourceLines:[],readOnly:true,configurationEnabled:false}});let tree=h.render();
 const toolbar=node(tree,n=>n.type?.name==='StandardToolbar');assert.equal(toolbar.props.items.find(item=>item?.props?.['aria-controls']==='allocation-send').props.disabled,true);
 toolbar.props.items.find(item=>item?.props?.['aria-controls']==='allocation-setup').props.onClick();tree=h.render();
 const setup=node(tree,n=>n.props?.id==='allocation-setup');assert.equal(setup.props.hidden,false);assert.ok(node(setup,n=>n.type?.name==='ProductionAllocationScope'));assert.doesNotMatch(renderToStaticMarkup(setup),/Quản trị hệ thống|Thiết lập quyền theo bộ phận|Áp dụng quyền/);assert.equal(flatten(tree).some(n=>n.type==='form'),false);
});

test('only a returned pending interval explains cancelled calendar assignment; it never hides an active transfer request',()=>{
 const cancelled={id:'cancelled-test',employeeId:'c1',targetLine:'A',...window,planning:true,canceled:true};
 const returned=render({view:{...view,offers:[{...offer,allocations:[cancelled]}]}});
 assert.match(returned,/Đã hủy phân công vào lịch · Trả lại Chờ phân bổ/);
 assert.match(returned,/Đề nghị chuyển từ Line C vẫn còn hiệu lực/);
 assert.match(returned,/QLSX phía gửi hoặc Admin có thể rút khoảng chờ/);
 assert.match(returned,/1 người đang chờ nhận/);assert.match(returned,/Chọn Ngọc/);
 for(const allocation of [{...cancelled,canceled:false},{...cancelled,employeeId:'other'},{...cancelled,effectiveAt:'2026-10-17T01:00:00Z',endsAt:'2026-10-17T02:00:00Z'}]){
  const html=render({view:{...view,offers:[{...offer,allocations:[allocation]}]}});assert.doesNotMatch(html,/Đã hủy phân công vào lịch · Trả lại Chờ phân bổ/);
 }
});
