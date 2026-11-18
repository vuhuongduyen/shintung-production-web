export const month='2026-10';
export function fullPayrollFixture(){
 const employees=[
  {id:'SYNTHETIC-A',name:'Synthetic own A',line:'A',startDate:'2020-01-01',active:true},
  {id:'SYNTHETIC-B',name:'Synthetic related B',line:'B',startDate:'2020-01-01',active:true},
  {id:'SYNTHETIC-B-UNRELATED',name:'Synthetic unrelated B',line:'B',startDate:'2020-01-01',active:true},
 ];
 const schedules=['A','B'].map(line=>{
  const days=Array.from({length:31},(_,i)=>({date:`${month}-${String(i+1).padStart(2,'0')}`,working:i===0,ot:false}));
  return {line,days,roster:days.map(d=>({date:d.date,hc:line==='A'?['SYNTHETIC-A']:['SYNTHETIC-B','SYNTHETIC-B-UNRELATED'],ot:[]})),input:{dailySchedule:days}};
 });
 const orders=['A','B'].map(line=>({id:'SYNTHETIC-LSX-'+line,lsxCode:'SYNTHETIC-LSX-'+line,line,sku:'SYNTHETIC-SKU-'+line}));
 const reports=orders.map(o=>({id:o.id+'-REPORT',kind:'completion',transitId:o.id,line:o.line,productionDate:month+'-01',reviewStatus:'Đã xác nhận',approvedQuantity:100,standardUnit:1}));
 const events=[{id:'SYNTHETIC-LOAN',kind:'line-movement',line:'B',destinationLine:'A',employees:['SYNTHETIC-B'],approved:true,effectiveAt:month+'-01T08:00:00+07:00',endsAt:month+'-01T12:00:00+07:00'}];
 return {employees,schedules,orders,reports,events,month,standards:new Map(orders.map(o=>[o.sku,1])),baseFund:6000000};
}
export function scopedPayrollFixture(line='A'){
 const full=fullPayrollFixture();
 return {...full,sessionLine:line,orders:full.orders.filter(o=>o.line===line),reports:full.reports.filter(r=>r.line===line),schedules:full.schedules.filter(s=>s.line===line),employees:full.employees.filter(e=>e.line===line||line==='A'&&e.id==='SYNTHETIC-B').map(e=>e.line===line?e:{id:e.id,name:e.name,line:e.line,active:e.active})};
}
