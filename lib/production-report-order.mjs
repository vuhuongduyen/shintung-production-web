const stage = value => String(value || '').trim().toUpperCase().replace(/^[ABC]\s*[-–]\s*/, '').replace(/\s+/g, ' ');
const stamp = row => Date.parse(row.completedAt || row.reportedAt || '') || 0;
const key = row => row.transitId || row.planId || row.id;

// Keep orders together, newest order first; routing takes precedence over
// completion time because stages can run in parallel or finish out of sequence.
export function sortReportStages(rows, orders = []) {
 const groups = new Map();
 for (const row of rows) {
  const id = key(row);
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(row);
 }
 return [...groups.values()].sort((a,b) => Math.max(...b.map(stamp))-Math.max(...a.map(stamp)) || String(key(a[0])).localeCompare(String(key(b[0])))).flatMap(group => {
  const order = orders.find(o => o.id === group[0].transitId || (!group[0].transitId && o.planId === group[0].planId));
  const route = (order?.processes || []).map(stage);
  const fallback = ['CUT','ASSY','CRIMP','PACKING','FINAL'];
  const rank = row => {
   const name = stage(row.stageName || row.stageCode);
   const exact = route.indexOf(name);
   if (exact >= 0) return exact;
   const base = name.replace(/\s+\d+$/, '');
   const configured = route.indexOf(base);
   if (configured >= 0) return configured;
   if (route.length) return route.length;
   const standard = fallback.indexOf(base);
   return standard < 0 ? fallback.length : standard;
  };
  return [...group].sort((a,b) => rank(a)-rank(b) || stage(a.stageName||a.stageCode).localeCompare(stage(b.stageName||b.stageCode),undefined,{numeric:true}) || stamp(a)-stamp(b) || String(a.id).localeCompare(String(b.id)));
 });
}

// Select once from the full dataset, before filters or pagination.
export function finalReportIds(reports, orders = []) {
 const chosen=new Map(),orderMap=new Map(orders.map(o=>[o.id,o]));
 for(const r of reports){
  if(r.kind!=='completion'||r.cancelled||r.voided||r.replacedByStageBatch||r.reviewStatus==='Đã hủy')continue;
  const order=orderMap.get(r.transitId),route=(order?.processes||[]).map(stage);
  const last=route.at(-1)||'FINAL';
  if(stage(r.stageName||r.stageCode)!==last)continue;
  const id=key(r),previous=chosen.get(id);
  if(!previous||stamp(r)>stamp(previous)||(stamp(r)===stamp(previous)&&String(r.id).localeCompare(String(previous.id))>0))chosen.set(id,r);
 }
 return new Set([...chosen.values()].map(r=>r.id));
}
