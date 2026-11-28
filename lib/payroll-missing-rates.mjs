// Only use the already-authorized overview. Never fetch another Line for diagnostics.
export function payrollMissingRates(overviews=[]){
 const result=[],seen=new Set();
 for(const overview of overviews)for(const row of overview.rows||[])for(const basis of row.basis||[]){
  if(basis.earned!=null||basis.omitted)continue;
  const key=JSON.stringify([overview.line,row.order?.id,basis.date]);if(seen.has(key))continue;seen.add(key);
  result.push({line:overview.line,sku:row.order?.sku||'',name:row.order?.name||'',orderCode:row.order?.lsxCode||row.order?.id||'',date:basis.date||'',reason:'missing-rate'});
 }
 return result;
}
