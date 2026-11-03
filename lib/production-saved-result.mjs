// Merge only acknowledged records, retaining unrelated orders and history.
export function mergeProductionSavedResult(value,result){
 const merge=(old,added)=>[...new Map([...old,...added].map(row=>[row.id,row])).values()];
 return {...value,events:merge(value.events,result.events||[]),reports:merge(value.reports,result.reports||[])};
}
