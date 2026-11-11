import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {newDailyCapacity} from '../lib/capacity.mjs';
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLInputElement','Event','CustomEvent','Node','localStorage'])globalThis[k]=dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:Editor}=await vite.ssrLoadModule('/components/capacity-daily-editor.tsx');
after(async()=>{await vite.close();dom.window.close();});
test('selector is absent by default, explicit selection is cancellable and only changes local draft',async()=>{
 const week='2027-02-01',ids=['QAOT_FIXTURE_A','QAOT_FIXTURE_B'];
 const employees=ids.map(id=>({id,name:`SYNTHETIC QA OT ${id}`,line:'B',active:false,startDate:week,endDate:'2027-02-02',employmentDatesManaged:true})).concat({id:'REAL_FIXTURE',name:'Other fixture',line:'B',active:true});
 const row=newDailyCapacity(week,'B');row.input.dailySchedule.forEach(d=>d.working=false);row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:[],ot:[],savedHc:['REAL_FIXTURE']}));
 let value=row.input,error='',scope=null,disabled=false,revision=0,changes=0;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=()=>root.render(React.createElement(Editor,{week,row:{...row,input:value},savedRevision:revision,testRoster:scope,employees,disabled,t:vi=>vi,onError:m=>error=m,onChange:next=>{changes++;value=next;render();}}));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const pick=()=>host.querySelector('input[aria-label="QAOT_FIXTURE_A · SYNTHETIC QA OT QAOT_FIXTURE_A"]');
 try{
  await act(async()=>render());assert.equal(button('Áp dụng danh sách thử'),undefined);
  scope={week,line:'B',employeeIds:ids};await act(async()=>render());assert.ok(button('Áp dụng danh sách thử'));assert.equal(host.querySelector('input[aria-label^="REAL_FIXTURE"]'),null);
  const original=JSON.stringify(value);await act(async()=>pick().click());assert.equal(changes,0);await act(async()=>button('Bỏ chọn').click());assert.equal(pick().checked,false);assert.equal(JSON.stringify(value),original);
  await act(async()=>pick().click());await act(async()=>button('Áp dụng danh sách thử').click());assert.equal(error,'');assert.equal(changes,1);assert.deepEqual(value.dailyRoster[0].savedHc,[ids[0]]);assert.ok(!JSON.stringify(value).includes('REAL_FIXTURE'));
  const hc=()=>host.querySelector('input[aria-label$="làm HC"]');await act(async()=>hc().click());assert.deepEqual(value.dailyRoster[0].hc,[ids[0]]);
  const ot=()=>host.querySelector('input[aria-label$="tăng ca"]');await act(async()=>ot().click());assert.deepEqual(value.dailyRoster[0].ot,[ids[0]]);
  await act(async()=>pick().click());revision++;await act(async()=>render());assert.equal(pick().checked,false);
  disabled=true;await act(async()=>render());assert.equal(pick().disabled,true);
  disabled=false;row.version=1;await act(async()=>render());assert.equal(pick().disabled,true);
  scope=null;await act(async()=>render());assert.equal(button('Áp dụng danh sách thử'),undefined);
 }finally{await act(async()=>root.unmount());host.remove();}
});
