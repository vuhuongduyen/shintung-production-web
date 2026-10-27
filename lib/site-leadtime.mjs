import base from '../app/leadtime-data.json' with {type:'json'};

const normalizeSku=value=>String(value||'').trim().toUpperCase();

// Read-only compatibility rows still count as existing Leadtime records.
const baseLeadtimeSkus=new Set(
 base.filter(item=>Number(item.leadTime)>0).map(item=>normalizeSku(item.sku)),
);

export const hasBaseLeadtime=sku=>baseLeadtimeSkus.has(normalizeSku(sku));
