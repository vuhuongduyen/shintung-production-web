import React from 'react';import {createRoot} from 'react-dom/client';import Journal from '../../components/production-labor-journal';
const at=(h:string)=>`2026-10-28T${h}:00+07:00`;
const orders=[{id:'O',lsxCode:'TEST-PHAO',line:'B',processes:['PHAO'],lsxQty:2000}],employees=[{id:'A',name:'Nhân viên giả A',line:'B'},{id:'B',name:'Nhân viên giả B',line:'C'}];
const event=(id:string,stageAction:string,time:string,before:string[],after:string[])=>({id,kind:'stage-work',stageReporting:true,stageAction,sourceId:'O',stageName:'PHAO',line:'B',effectiveAt:at(time),recordedAt:at(time),actorId:'TEST-OPERATOR',employees:after,stageBefore:{people:before,status:'running'},stageAfter:{people:after,status:'running',at:at(time)}});
const events=[event('S','start','08:00',[],['A']),event('E','complete','10:00',['A'],['B'])];
createRoot(document.getElementById('root')!).render(<div className="app-shell"><section className="production-workspace"><Journal events={events} reports={[]} orders={orders} employees={employees} t={s=>s} open={()=>{}} refresh={()=>{}} busy={false} extraItems={[]} setCategory={()=>{}}/></section></div>);
