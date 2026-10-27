import {getTransit} from './in-transit.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {planTransitBacklog} from '../../lib/plan-transit-backlog.mjs';
export async function readPlanTransitBacklog(db,week,labor){
 if(!labor){const {results}=await db.prepare("SELECT record_key,payload,updated_at FROM app_records WHERE entity='labor_hours'").all();labor=siteLaborHours(results.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at}))).map(r=>r.payload);}
 const {rows}=await getTransit(db,{},[],{planningOnly:true});
 return planTransitBacklog(rows,week,labor);
}
