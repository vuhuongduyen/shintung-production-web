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
test('actual HC checkbox returns from 10 to 0 to 10; overtime guard still blocks removing HC',async()=>{
 const row=newDailyCapacity('2026-10-26','A');row.input.workers=10;row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:d.working?Array.from({length:10},(_,i)=>`E${i}`):[],ot:[]}));
 let value=row.input,error='';const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=()=>root.render(React.createElement(Editor,{week:row.week,row:{...row,input:value},disabled:false,t:vi=>vi,onError:m=>error=m,onChange:next=>{value=next;render();}}));
 try{await act(async()=>render());const check=()=>host.querySelector('input[aria-label$="làm HC"]');const count=()=>host.querySelector('.cap-days-table tbody tr td[data-label="NV HC"]').textContent;
 assert.match(count(),/10/);await act(async()=>check().click());assert.match(count(),/0/);assert.equal(value.dailyRoster[0].hc.length,0);await act(async()=>check().click());assert.match(count(),/10/);assert.equal(value.dailyRoster[0].hc.length,10);
 value={...value,dailySchedule:value.dailySchedule.map((d,i)=>i===0?{...d,ot:true}:d)};await act(async()=>render());await act(async()=>check().click());assert.equal(value.dailySchedule[0].working,true);assert.match(error,/tăng ca/);
 }finally{await act(async()=>root.unmount());host.remove();}
});
