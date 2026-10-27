import {monthlyEarnedOrders,payrollPreview,nonNegative,allocateLineFunds} from './production-payroll.mjs';
import {monthlyAttendance} from './production-monthly-attendance.mjs';
import {outputDate} from './production-output-summary.mjs';
/** @param {{orders:any[],reports:any[],events:any[],schedules:any[],employees:any[],month:string,standards:Map<string,number>,baseFund?:number|string,sessionLine?:string,drafts?:Record<string,any>,standardIssues?:string[]}} input */
export function payrollMonth({orders,reports,events,schedules,employees,month,standards,baseFund=6000000,sessionLine,drafts={},standardIssues=[]}){
 const earnedByLine=Object.fromEntries(['A','B'].map(l=>[l,monthlyEarnedOrders(orders,reports,month,l,standards,true)]));
 const totalEarned=(rows)=>rows.some(r=>r.earned===null)?null:rows.reduce((sum,r)=>sum+Number(r.earned),0);
 const allocation=allocateLineFunds(sessionLine?null:totalEarned(earnedByLine.A),sessionLine?null:totalEarned(earnedByLine.B),baseFund);
 const attendance=Object.fromEntries(['A','B'].map(line=>[line,monthlyAttendance({events,schedules,orders,employees,month,line})]));
 const allocationIssues=[...(sessionLine?['Cần quyền xem cả Line A và B để phân bổ quỹ chung']:allocation.issues),...(reports.some(r=>r.kind==='completion'&&!r.cancelled&&!r.voided&&r.reviewStatus==='Đã xác nhận'&&orders.some(o=>o.id===r.transitId&&['A','B'].includes(o.line))&&!outputDate(r))?['Báo công đã xác nhận thiếu ngày sản lượng']:[]),...standardIssues];
 const overview=(l)=>{
  const calculated=attendance[l],helper={issues:calculated.issues},rows=earnedByLine[l]||[],earned=totalEarned(rows);
  const otherPeople=new Map(attendance[l==='A'?'B':'A'].people.map((p)=>[p.id,p]));
  const people=calculated.people.map((p)=>{
   const other=otherPeople.get(p.id);
   const otherLineHours=Number(other?.transferFromHours?.[l]||0);
   return {...p,otherLineHours,include:drafts[`${month}:${l}:${p.id}`]?.include??true};
  });
  const selected=people.filter(p=>p.include),unknownHelper=false;
  const share=allocation.lines.find((row)=>row.line===l);
  /** @type {any} */ const result=payrollPreview(earned,selected,share?.allocated??null,[...allocationIssues,...['A','B'].flatMap(key=>attendance[key].issues.map((issue)=>`Line ${key}: ${issue}`)),...(unknownHelper?['Phụ kho có nhân viên chưa có trong danh sách']:[])],month);
  const validHours=selected.length>0&&selected.every(p=>nonNegative(p.hc)!==null&&nonNegative(p.ot)!==null&&Number(p.hc)+Number(p.ot)<=744);
  const actual=validHours?selected.reduce((n,p)=>n+Number(p.hc)+Number(p.ot),0):null;
  const support=unknownHelper?null:selected.reduce((n,p)=>n+p.helper,0);
  const production=actual===null||support===null||selected.some(p=>p.helper>Number(p.hc)+Number(p.ot))?null:actual-support-selected.reduce((n,p)=>n+Number(p.otherWork||0),0);
  return {line:l,helper,rows,people,selected,earned,share,result,actual,support,production,quantity:rows.reduce((n,r)=>n+r.qty,0),missing:new Set(rows.filter(r=>r.earned===null).map(r=>r.order.sku)).size};
 };
 const overviews=(sessionLine?[sessionLine]:['A','B']).map(overview);
 const sharedIssues=overviews.flatMap(r=>r.result.issues.map(issue=>`Line ${r.line}: ${issue}`));
 if(sharedIssues.length)for(const row of overviews)if(!row.result.issues.length)row.result={...row.result,issues:sharedIssues,score:null,factor:null,fund:null,paid:null,unallocated:null,returned:null,redistributed:null,payments:new Map(),details:new Map()};
 return overviews;
}
