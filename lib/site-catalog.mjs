import legacy from './site-legacy-skus.json' with {type:'json'};
import demand from '../app/demand-event-data.json' with {type:'json'};

export function siteDemand(records) {
 const map=new Map(demand.map(payload=>[payload.id,{key:payload.id,payload,updatedAt:payload.updatedAt,updatedBy:payload.updatedBy}]));
 for(const record of records)map.set(record.key,record);
 return [...map.values()];
}

// Compatibility projection only. Never seed or update LIVE records on reads.
export function legacyView(payload) {
  if (payload._deleted || payload.confirmation_status || payload.usage_status) return payload;
  if (!['Đang sử dụng', 'Đã xác nhận'].includes(payload.status)) return payload;
  return {...payload, confirmation_status:'Đã xác nhận', usage_status:'Đang sử dụng', status_source:'LEGACY_READ_ONLY'};
}
export function siteCatalog(records) {
  const map = new Map(legacy.map(payload => [payload.code, {key:payload.code,payload:legacyView(payload),updatedAt:'',updatedBy:''}]));
  for (const record of records) map.set(record.key, {...record,payload:legacyView(record.payload)});
  return [...map.values()];
}
