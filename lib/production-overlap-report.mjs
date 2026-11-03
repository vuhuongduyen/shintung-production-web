import {correctionStage} from './production-correction-orders.mjs';
// Half-open intervals: an exit at 10:00 and entry at 10:00 do not overlap.
/** @param {{events?:Record<string,any>[],reports?:Record<string,any>[],orders?:Record<string,any>[],employees?:Record<string,any>[],from:string,to:string}} options */
export function productionOverlapRows({events=[],reports=[],orders=[],employees=[],from,to}){
 const lo=Date.parse(from+'T00:00:00+07:00'),hi=Date.parse(to+'T00:00:00+07:00')+86400000;
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo)throw Error('Chọn khoảng ngày hợp lệ.');
 const end=Math.min(hi,Date.now()),byPerson=new Map(),orderMap=new Map(orders.map(o=>[o.id,o]));
 const add=(id,orderId,stage,a,b,line)=>{a=Math.max(a,lo);b=Math.min(b,end);if(!(b>a))return;const o=orderMap.get(orderId)||{};const row={orderId,stage,from:a,to:b,line:line||o.line||'',lsx:o.lsxCode||orderId};if(!byPerson.has(id))byPerson.set(id,[]);byPerson.get(id).push(row);};
 const liveReports=reports.filter(r=>!r.cancelled&&!r.voided&&r.kind==='completion');
 // Named calculated work intervals already exclude pauses and nonworking time.
 for(const r of liveReports)for(const x of r.hours?.staffing||[])for(const id of x.employees||[])add(id,r.transitId,correctionStage(r),Date.parse(x.from),Date.parse(x.to),r.line);
 const groups=new Map();for(const e of events)if(!e.voided&&e.stageReporting&&e.stageAfter){const key=JSON.stringify([e.sourceId,correctionStage(e)]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 for(const es of groups.values()){
 es.sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||'')));
 const first=es[0],rs=liveReports.filter(r=>r.transitId===first.sourceId&&correctionStage(r)===correctionStage(first));
 for(let i=0;i<es.length;i++){const e=es[i];if(e.stageAfter.status!=='running')continue;const a=Date.parse(e.effectiveAt),b=i+1<es.length?Date.parse(es[i+1].effectiveAt):end;
 // Completed intervals are represented by their report; add unreported gaps only.
 let gaps=[[a,b]];for(const r of rs){const ra=Date.parse(r.startedAt),rb=Date.parse(r.completedAt);gaps=gaps.flatMap(([x,y])=>rb<=x||ra>=y?[[x,y]]:[[x,Math.min(y,ra)],[Math.max(x,rb),y]].filter(([u,v])=>v>u));}
 for(const [x,y]of gaps)for(const id of e.stageAfter.people||[])add(id,e.sourceId,correctionStage(e),x,y,e.line);
 }}
 const found=new Map();for(const [id,items]of byPerson){items.sort((a,b)=>a.from-b.from);for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length&&items[j].from<items[i].to;j++){let a=items[i],b=items[j];if(a.orderId===b.orderId&&a.stage===b.stage)continue;if(JSON.stringify([a.orderId,a.stage])>JSON.stringify([b.orderId,b.stage]))[a,b]=[b,a];const x=Math.max(a.from,b.from),y=Math.min(a.to,b.to);if(y<=x)continue;const key=JSON.stringify([id,a.orderId,a.stage,b.orderId,b.stage]);if(!found.has(key))found.set(key,{employeeId:id,employeeName:employees.find(p=>p.id===id)?.name||id,a,b,intervals:[]});found.get(key).intervals.push([x,y]);}}
 const result=[];for(const item of found.values()){const merged=[];for(const [a,b]of item.intervals.sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(b,last[1]);else merged.push([a,b]);}for(const [a,b]of merged)result.push({...item,from:new Date(a).toISOString(),to:new Date(b).toISOString(),minutes:(b-a)/60000,status:'Chưa xử lý'});}
 return result.sort((a,b)=>a.from.localeCompare(b.from)||a.employeeName.localeCompare(b.employeeName));
}
