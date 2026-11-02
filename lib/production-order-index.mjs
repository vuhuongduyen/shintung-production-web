import {progressReviewSummary} from './production-progress-review.mjs';
// Index once per snapshot; controls and table cells reuse an order's own history.
export function productionOrderIndex(orders,reports,events,now=new Date().toISOString()) {
 const reportsByOrder=new Map(),eventsByOrder=new Map(),summaries=new Map();
 const add=(map,key,value)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
 for(const r of reports)add(reportsByOrder,r.transitId,r);
 for(const e of events)for(const id of new Set([e.sourceId,e.destinationId]))add(eventsByOrder,id,e);
 const sources=new Map();
 const summaryFor=o=>{if(sources.get(o.id)!==o){sources.set(o.id,o);summaries.set(o.id,progressReviewSummary(o,reportsByOrder.get(o.id)||[],eventsByOrder.get(o.id)||[],now));}return summaries.get(o.id);};
 for(const o of orders)summaryFor(o);
 return {summaries,reportsByOrder,eventsByOrder,summaryFor};
}
