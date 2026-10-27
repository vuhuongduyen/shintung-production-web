export const warehouseHelperNames=['Nhân viên mẫu 101','Nhân viên mẫu 102','Nhân viên mẫu 103'];
const normalize=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
export const warehouseHelpers=employees=>warehouseHelperNames.flatMap(name=>employees.filter(p=>p.active!==false&&!p._deleted&&normalize(p.name)===normalize(name)));
export const dutyDates=week=>Array.from({length:6},(_,i)=>new Date(Date.parse(`${week}T00:00:00Z`)+i*86400000).toISOString().slice(0,10));
export function latestDuty(events,week,line){return events.filter(e=>e.kind==='warehouse-duty'&&e.week===week&&e.line===line&&!e.voided).at(-1)||null;}
export function dutyRows(events,week,line,attendance){
 const plan=latestDuty(events,week,line);
 return dutyDates(week).flatMap(date=>{
  const planned=plan?.rows?.filter(r=>r.date===date)||[];
  return (planned.length?planned:[{date,employee:'',start:'',end:''}]).map(saved=>{
  const row={...saved,rowId:saved.rowId||date};
  const actual=attendance.find(e=>e.warehouseDutyKey===`${week}:${line}:${row.rowId}`&&e.absenceType==='Phụ kho');
  if(actual)return {...row,employee:actual.employees[0],start:new Date(Date.parse(actual.effectiveAt)+25200000).toISOString().slice(11,16),end:new Date(Date.parse(actual.endsAt)+25200000).toISOString().slice(11,16),attendanceId:actual.id,approved:actual.approved};
  return {...row,...(row.attendanceId?{start:'',end:'',attendanceId:null}:{})};
  });
 });
}
