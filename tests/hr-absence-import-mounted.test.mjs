import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import {createServer} from 'vite';import {zipSync,strToU8} from 'fflate';
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','MutationObserver','DOMParser'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:Import}=await vite.ssrLoadModule('/components/hr-absence-import.tsx');
const oldFetch=globalThis.fetch;after(async()=>{globalThis.fetch=oldFetch;await vite.close();dom.window.close();});
async function mount(allowed=true,items=[]){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(React.createElement(Import,{month:'2026-11',allowed,busy:false,items,t:s=>s})));return {host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const button=(host,text)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const click=async node=>{assert.ok(node);await act(async()=>node.click());};
const settle=async predicate=>{for(let n=0;n<100&&!predicate();n++)await act(async()=>new Promise(r=>setTimeout(r,10)));assert.ok(predicate());};
function fixture(){const values=[['Ngày xin phép','Mã nhân viên','Tên NV','Loại nghỉ phép','Tên nghỉ phép','Thời gian bắt đầu','Thời gian kết thúc','Thời gian xin phép'],['16/11/2026','TEST001','Minh Anh','PN','Phép năm','08:00','17:00','08:00']];return new File([zipSync({'xl/workbook.xml':strToU8('<workbook xmlns:r="r"><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>'),'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>'),'xl/worksheets/sheet1.xml':strToU8('<worksheet><sheetData>'+values.map((r,i)=>`<row r="${i+1}">`+r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>')})],'TEST.xlsx');}
async function chooseFile(host){const input=host.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[fixture()],configurable:true});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
test('file choice automatically saves once and shows read-only results without extra controls',async()=>{
 const calls=[];globalThis.fetch=async(_,options)=>{const b=JSON.parse(options.body);calls.push(b);return new Response(JSON.stringify({saved:true,count:1,results:b.rows.map(r=>({...r,status:'valid'}))}));};
 const m=await mount();try{
  await chooseFile(m.host);await settle(()=>m.host.textContent.includes('Thành công: 1'));
  assert.equal(calls.length,1);assert.equal(calls[0].action,'hr-import-save');assert.equal(calls[0].automatic,true);
  for(const label of ['Kiểm tra dữ liệu','Xác nhận nhập','Hủy tải file','Bỏ dòng'])assert.equal(button(m.host,label),undefined);
  assert.equal(m.host.querySelector('select'),null);assert.ok(button(m.host,'Hủy lần nhập'));assert.match(m.host.textContent,/Đã lưu/);
 }finally{await m.close();}
});
test('overload does not retry or claim saved; another choice while saving cannot submit twice',async()=>{
 let calls=0,release;globalThis.fetch=()=>{calls++;return new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({error:'D1 quá tải'}),{status:503}));});};
 const m=await mount();try{
  await chooseFile(m.host);await settle(()=>calls===1);await chooseFile(m.host);assert.equal(calls,1);
  await act(async()=>release());await settle(()=>m.host.textContent.includes('D1 quá tải'));
  assert.equal(calls,1);assert.doesNotMatch(m.host.textContent,/Thành công|Đã lưu/);assert.match(m.host.textContent,/Chưa xác nhận lưu/);
 }finally{await m.close();}
});
test('cancel chooser has no side effect; impact and reason are required; cancel error keeps selection for review',async()=>{
 const calls=[];globalThis.fetch=async(_,options)=>{const b=JSON.parse(options.body);calls.push(b);const data=b.action==='hr-import-history'?{rows:[{id:'TEST-IMPORT',fileName:'TEST.xlsx',createdAt:'2026-11-17T01:00:00Z',actor:'TEST-HR',count:1,status:'active'}],page:0,hasMore:false}:b.action==='hr-import-cancel-preview'?{batch:{id:'TEST-IMPORT',fileName:'TEST.xlsx',count:1},rows:[],issues:[],canCancel:true}:{error:'Bản ghi đã sửa; cần đối chiếu.'};return new Response(JSON.stringify(data),{status:b.action==='hr-import-cancel'?409:200});};
 const m=await mount();try{
  await click(button(m.host,'Hủy lần nhập'));await click(button(m.host,'Chọn'));assert.equal(calls.some(b=>b.action==='hr-import-cancel'),false);const confirm=button(m.host,'Xác nhận hủy lần nhập');assert.equal(confirm.disabled,true);
  const reason=m.host.querySelector('input:not([type=file])');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(reason,'Chọn nhầm file');reason.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(confirm.disabled,false);await click(confirm);assert.match(m.host.textContent,/Bản ghi đã sửa/);assert.ok(button(m.host,'Xác nhận hủy lần nhập'));
 }finally{await m.close();}
});
test('without HR permission import and cancellation controls are absent and mounting never calls API',async()=>{globalThis.fetch=()=>{throw Error('No request on mount');};const m=await mount(false);try{assert.equal(button(m.host,'Tải file Excel'),undefined);assert.equal(button(m.host,'Hủy lần nhập'),undefined);}finally{await m.close();}});

test('HR toolbar keeps month and back before adjacent Excel actions',async()=>{
 const {toolbar}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
 const m=await mount(true,[toolbar.field('Tháng ghi nhận',[toolbar.input({type:'month',value:'2026-11',readOnly:true})]),toolbar.action({onClick(){}},'Quay lại',true,'back')]);try{
 assert.deepEqual([...m.host.querySelectorAll('[data-standard-toolbar=HrAttendanceEntry] input,[data-standard-toolbar=HrAttendanceEntry] button')].map(n=>n.tagName==='INPUT'?'month':n.textContent.trim()),['month','Quay lại','Tải file Excel','Hủy lần nhập']);
 }finally{await m.close();}
});
