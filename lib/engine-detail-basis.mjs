// A saved run is authoritative even when incomplete. Never repair its explanation
// with a newly calculated run, current Forecast, Demand Events or master values.
export function engineDetailBasis(saved,week,sku,calculated) {
 const persisted=saved?.payload?.week===week;
 const rows=persisted?saved.payload.rows:calculated?.rows;
 const row=Array.isArray(rows)?rows.find(row=>row.sku===sku):undefined;
 if(!row)return null;
 const entries=persisted?saved.payload.metrics:calculated?.metrics;
 const metric=entries instanceof Map?entries.get(row.id):Array.isArray(entries)?entries.find(entry=>Array.isArray(entry)&&entry[0]===row.id)?.[1]:undefined;
 return {row,metric:metric??(persisted?row.engineCalculationBasis?.metric:undefined)??null};
}
