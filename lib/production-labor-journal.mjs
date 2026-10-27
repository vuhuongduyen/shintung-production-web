import {assignedAt,employeesAt} from './production-hours.mjs';
import {journalContext} from './production-journal.mjs';
const key=v=>String(v||'').toUpperCase();
const movement=e=>['start','add','reduce','transfer'].includes(e.kind)||e.kind==='complete'&&e.finalCompletion;
const valid=e=>!e.voided&&!e.cancelled&&Number.isFinite(Date.parse(e.effectiveAt));
export function laborJournal(events,orders,employees,now=Date.now()) {
 const sorted=events.filter(valid).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt))||String(a.id).localeCompare(String(b.id)));
 const endpoint=(id,line,label)=>{const order=orders.find(o=>o.id===id);return {id,lsx:order?.lsxCode||'',sku:order?.sku||'',name:order?.name||'',spec:order?.spec||'',line:order?.line||line||'',label:order?.lsxCode?`LSX ${order.lsxCode}`:id?'Chưa có lệnh trong danh sách':label};};
 const count=(es,id,at)=>{if(!id)return null;const state=assignedAt(es,id,at);return state.known?state.count:null;};
 const rows=sorted.filter(e=>movement(e)||['absence','line-absence','attendance-override'].includes(e.kind)).map(e=>{
  // Include pause/resume and other source events in the same canonical replay.
  const prior=sorted.slice(0,sorted.indexOf(e));const at=Date.parse(e.effectiveAt),after=[...prior,e];
  const source=['start','add'].includes(e.kind)?endpoint(null,e.line,'Nhân lực chưa phân công'):endpoint(e.sourceId,e.line,'Theo Line');
  const destination=['start','add'].includes(e.kind)?endpoint(e.sourceId,e.line,'Theo Line'):e.kind==='transfer'?endpoint(e.destinationId,e.destinationLine,'Chưa có lệnh đích'):['reduce','complete'].includes(e.kind)?endpoint(null,e.line,'Chờ phân bổ'):endpoint(e.sourceId,e.line,'Theo Line');
  const sourceBefore=['start','add'].includes(e.kind)?null:(e.before?.source??count(prior,e.sourceId,at));
  const sourceAfter=['start','add'].includes(e.kind)?null:(e.after?.source??count(after,e.sourceId,at));
  const destId=['start','add'].includes(e.kind)?e.sourceId:e.kind==='transfer'?e.destinationId:null;
  const context=journalContext(e,orders,employees);
  return {...context,source,destination,sourceBefore,sourceAfter,destinationBefore:destId===e.sourceId?(e.before?.source??count(prior,destId,at)):count(prior,destId,at),destinationAfter:destId===e.sourceId?(e.after?.source??count(after,destId,at)):count(after,destId,at),line:[...new Set([source.line,destination.line].filter(Boolean))].join(' / '),movement:movement(e)};
 });
 const effective=sorted.filter(e=>Date.parse(e.effectiveAt)<=now);
 const assignments=orders.map(o=>({order:o,ids:employeesAt(effective,o.id,now),state:assignedAt(effective,o.id,now)}));
 const positions=employees.map(p=>{
  const id=key(p.id),locations=assignments.filter(a=>a.ids?.some(v=>key(v)===id));
  const history=rows.filter(e=>(e.employees||[]).some(v=>key(v)===id));
  const last=history.filter(e=>e.movement&&Date.parse(e.effectiveAt)<=now).at(-1);
  const ambiguous=locations.length>1||assignments.some(a=>a.ids===null&&a.state.count>0&&effective.some(e=>(e.sourceId===a.order.id||e.destinationId===a.order.id)&&(e.employees||[]).some(v=>key(v)===id)));
  const released=last&&['reduce','complete'].includes(last.kind);
  const status=ambiguous?'Cần kiểm tra':locations.length===1?'Đang ở LSX':released?'Chờ phân bổ':'Chưa xác định';
  const order=locations.length===1?locations[0].order:null;
  return {...p,status,position:status,order,lsx:order?.lsxCode||'',sku:order?.sku||'',productName:order?.name||'',line:order?.line||last?.destinationLine||last?.line||p.line,employee:`${p.name||''} ${p.id}`,effectiveAt:last?.effectiveAt,operation:last?.operation,actorId:last?.actorId,history:history.slice().reverse(),conflictingOrders:locations.map(a=>a.order)};
 });
 return {rows:rows.reverse(),positions};
}
export function filterLabor(rows,filters={},current=false) {
 const query=String(filters.value||'').trim().toLocaleLowerCase('vi');
 return rows.filter(r=>{
  const field=filters.field||'employee';
  const search=current?(field==='name'?r.productName:field==='actor'?r.actorId:r[field]):field==='lsx'?[r.source?.lsx,r.destination?.lsx].join(' '):field==='sku'?[r.source?.sku,r.destination?.sku].join(' '):field==='name'?[r.source?.name,r.destination?.name].join(' '):field==='actor'?r.actorId:r[field];
  if(query&&!String(search||'').toLocaleLowerCase('vi').includes(query))return false;
  if(filters.line&&filters.line!=='all'&&!String(r.line||'').split(' / ').includes(filters.line))return false;
  if(filters.status&&filters.status!=='all'&&r.status!==filters.status)return false;
  const day=r.effectiveAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(r.effectiveAt)):'';
  return (!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);
 });
}
