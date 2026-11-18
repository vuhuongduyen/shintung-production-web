import {readRecordPages} from './production-record-pages.mjs';
import {transitProductionPayload} from './transit-production-read.mjs';
export const transitSummaryEntities=['in_transit','production_report','production_event','production_history_import'];
// One authorized/request-local scope, with the same projections and byte
// limit as the individual readers. Group keys once instead of serializing
// four metadata/payload round trips for each order aggregation window.
export async function readTransitSummary(db){
 const expression=`CASE entity ${transitSummaryEntities.map(entity=>`WHEN '${entity}' THEN ${transitProductionPayload(entity)}`).join(' ')} ELSE payload END`;
 const records=await readRecordPages(db,{where:`entity IN (${transitSummaryEntities.map(entity=>`'${entity}'`).join(',')})`,payloadExpression:expression});
 const grouped=new Map(transitSummaryEntities.map(entity=>[entity,[]]));
 for(const record of records)grouped.get(record.entity).push(record);
 for(const rows of grouped.values())rows.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||a.record_key.localeCompare(b.record_key));
 return grouped;
}
