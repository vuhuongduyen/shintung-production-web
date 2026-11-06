import {isDailyOutput} from './production-report-model.mjs';
import {mergeProduction} from './in-transit.mjs';
const productionFields=['completedQty','pendingReportQty','inTransitQty','actualStartedAt','actualCompletedAt','productionState','progressStatus','progress','delayDays','actualLeadtime','productionReceiveCount','productionReceivedAt'];
// Merge only acknowledged records, retaining unrelated orders and history.
export function mergeProductionSavedResult(value,result){
 const merge=(old,added)=>[...new Map([...old,...added].map(row=>[row.id,row])).values()];
 const known=new Map(value.reports.map(row=>[row.id,row]));
 for(const row of result.reports||[]){
  const previous=known.get(row.id),oldVersion=Number(previous?.version),version=Number(row.version);
  // A delayed ACK/replay cannot roll back a newer report already read locally.
  if(isDailyOutput(row)&&isDailyOutput(previous)&&Number.isInteger(oldVersion)&&(!Number.isInteger(version)||oldVersion>version))continue;
  known.set(row.id,row);
 }
 const reports=[...known.values()];
 const affected=new Set((result.reports||[]).filter(isDailyOutput).map(row=>row.transitId));
 const project=orders=>orders.map(order=>{
  if(!affected.has(order.id)||order.historicalOnly)return order;
  const state=mergeProduction(order,reports);
  // Read-model fields only: preserve revision, cancellation, planning/master
  // metadata and every unrelated row. This never writes an order to the server.
  return {...order,...Object.fromEntries(productionFields.map(key=>[key,state[key]]))};
 });
 return {...value,events:merge(value.events,result.events||[]),reports,...(affected.size?{orders:project(value.orders),...(value.progressOrders?{progressOrders:project(value.progressOrders)}:{})}:{})};
}
