/** @param {{page?:number,sort?:string,applied?:Record<string,any>|null,line?:string,format?:string|null}} options */
export function productionOrderPageUrl({page=1,sort='due',applied=null,line='all',format=null}={}){
 const params=new URLSearchParams({page:String(page),sort,line:applied?.line||line});
 if(applied){params.set('field',applied.field);params.set('query',applied.query||'');params.set('status',applied.status||'all');}
 if(format)params.set('format',format);
 return '/api/production-order-pages?'+params;
}
// A saved result can be applied once immediately, while a held dialog defers
// its refresh. An uncertain/replayed write is reconciled by a read, not added.
export function applyPagedProductionSave(snapshot,result,seen){
 const report=result?.report;if(!snapshot||!report?.id||result.replayed||seen.has(report.id))return snapshot;
 const order=snapshot.orders.find(o=>o.id===report.transitId);if(!order)return snapshot;
 seen.add(report.id);const quantity=Number(report.reportedQuantity);
 const totals={...order.serverSummary.totals,pending:order.serverSummary.totals.pending+quantity,reported:order.serverSummary.totals.reported+quantity};
 const runtime={...order.serverSummary.runtime,known:true,running:order.serverSummary.runtime?.known?order.serverSummary.runtime.running:true};
 const badge=Number(order.lsxQty)>0&&totals.reported>=Number(order.lsxQty)?{label:'Chờ xác nhận HT',tone:'review'}:!order.serverSummary.runtime?.known?{label:'Đang SX',tone:'running'}:order.serverSummary.badge;
 return {...snapshot,totals:{...snapshot.totals,pending:snapshot.totals.pending+quantity},orders:snapshot.orders.map(o=>o.id!==order.id?o:{...o,pendingReportQty:Number(o.pendingReportQty||0)+quantity,serverSummary:{...o.serverSummary,totals,runtime,badge}})};
}
