import {correctionOrderRows} from './production-correction-orders.mjs';
/** Merge only server-confirmed changes, so the next edit uses new event versions immediately. */
export function applyCorrectionResult(selected,result){
 const events=new Map((selected.events||[]).map(e=>[e.id,e])),reports=new Map((selected.reports||[]).map(r=>[r.id,r]));
 for(const c of result.event?.eventChanges||result.eventChanges||[])if(c.after)events.set(c.eventId||c.after.id,c.after);
 for(const c of result.reportImpacts||result.event?.reportChanges||[]){if(!c.after)continue;const old=reports.get(c.reportId)||{},next={...old,...c.after,id:c.reportId};if(c.after.quantity!==undefined)next.reportedQuantity=c.after.quantity;if(c.after.status!==undefined)next.reviewStatus=c.after.status;reports.set(c.reportId,next);}
 if(result.event?.id)events.set(result.event.id,result.event);
 const rows=correctionOrderRows([selected],[...events.values()],[...reports.values()]);
 return rows.find(r=>r.id===selected.id)||{...selected,events:[...events.values()].filter(e=>!e.voided),reports:[...reports.values()].filter(r=>!r.cancelled&&!r.voided)};
}
