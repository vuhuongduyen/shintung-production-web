import {productionHistoryOrder as payrollHistoryOrder} from './production-history-order.mjs';
export {payrollHistoryOrder};
import {earnedReportBasis,legacyEarnedModel} from './production-legacy-earned-basis.mjs';
import {isDailyOutput,dailyEarnedHours} from './production-daily-output.mjs';
import {validEmploymentDate} from './employee-employment.mjs';
import {outputDate,hasFinishedOutput,orderLaborOutput} from './production-output-summary.mjs';
import {effectiveAttendance} from './production-attendance.mjs';
export const efficiencyBands=[{min:100,factor:1},{min:95,factor:.95},{min:90,factor:.9},{min:85,factor:.85},{min:0,factor:0}];
export function efficiencyFactor(score){return Number.isFinite(score)&&score>=0?efficiencyBands.find(b=>score>=b.min)?.factor??0:null;}
export function nonNegative(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;}
export function standardForOrder(order,standards=new Map()){
 const snapshot=nonNegative(order.laborHour);
 if(snapshot!==null)return {unit:snapshot,source:'Theo LSX'};
 const unit=nonNegative(standards.get(String(order.sku||'').trim().toUpperCase()));
 return {unit,source:unit===null?'Thiếu định mức':'Định mức hiện hành'};
}
export function monthlyEarnedOrders(orders,reports,month,line,standards=new Map(),currentOnly=false){
 const byOrder=new Map(),contexts=[...orders],ids=new Set(orders.map(o=>o.id));
 for(const r of reports){if(!byOrder.has(r.transitId))byOrder.set(r.transitId,[]);byOrder.get(r.transitId).push(r);
  if(!ids.has(r.transitId)){const historical=payrollHistoryOrder(r);if(historical){contexts.push(historical);ids.add(r.transitId);}}
 }
 return contexts.flatMap(order=>{
  const all=byOrder.get(order.id)||[],own=all.filter(r=>hasFinishedOutput(r)&&r.reviewStatus==='Đã xác nhận'&&outputDate(r).slice(0,7)===month&&(isDailyOutput(r)?String(r.line)===line:r.legacyEarnedBasis?.kind===legacyEarnedModel?String(r.legacyEarnedBasis.line)===line:String(order.line)===line));
  if(!own.length)return [];
  const qty=own.reduce((sum,r)=>sum+Number(r.approvedQuantity??r.reportedQuantity??0),0),standard=currentOnly?{unit:nonNegative(standards.get(String(order.sku||'').trim().toUpperCase())),source:'Menu Giờ công'}:standardForOrder(order,standards);
  const reported=orderLaborOutput(order,all).total;
  const daily=own.filter(isDailyOutput),preserved=own.filter(r=>r.legacyEarnedBasis?.kind===legacyEarnedModel);
  if(!daily.length&&!preserved.length)return [{order,qty,reported,...standard,earned:standard.unit===null?null:qty*standard.unit}];
  const captured=payrollHistoryOrder(daily[0]||preserved[0]),allAnchored=own.every(r=>isDailyOutput(r)||r.legacyEarnedBasis?.kind===legacyEarnedModel);
  const changed=order.historicalOnly||captured&&['line','sku','lsxCode'].some(k=>captured[k]!==order[k]);
  const historicalOrder=allAnchored&&captured?(changed?captured:{...order,...Object.fromEntries(['line','sku','lsxCode','planId','name','spec'].filter(k=>captured[k]!==undefined).map(k=>[k,captured[k]]))}):order;
  const basis=own.map(r=>({reportId:r.id,date:outputDate(r),qty:Number(r.approvedQuantity??r.reportedQuantity??0),...earnedReportBasis(r,standard)}));
  const missing=basis.some(r=>r.earned===null),units=[...new Set(basis.map(r=>r.unit))];
  return [{order:historicalOrder,qty,reported,unit:units.length===1?units[0]:null,source:missing?'Thiếu căn cứ định mức':daily.length?'Theo ngày sản xuất':'Kết quả legacy được bảo toàn',basis,earned:missing?null:basis.reduce((sum,r)=>sum+r.earned,0)}];
 });
}

const clock=value=>{const m=/^(\d{2}):(\d{2})$/.exec(String(value||''));return m?Number(m[1])*60+Number(m[2]):null;};
function workingAt(day,minute){
 const hc=day.working&&minute>=clock(day.hcStart)&&minute<clock(day.hcEnd),ot=day.ot&&minute>=clock(day.otStart)&&minute<clock(day.otEnd);
 if(!hc&&!ot)return false;
 if(hc&&minute>=clock(day.lunchStart)&&minute<clock(day.lunchEnd))return false;
 return !(day.breaks||[]).some(b=>minute>=clock(b.start)&&minute<clock(b.end));
}
// Minute sets union duplicate/overlapping helper events and clip month/shift/breaks.
export function monthlyHelperHours(events,schedules,orders,month,line){
 const start=Date.parse(`${month}-01T00:00:00+07:00`),next=new Date(`${month}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 const end=Date.parse(`${next.toISOString().slice(0,10)}T00:00:00+07:00`),issues=new Set(),sets=new Map(),dates=new Map();
 for(const s of schedules.filter(s=>s.line===line||s.key?.endsWith(`:${line}`)))for(const d of s.days||[])if(d.date?.startsWith(month))dates.set(d.date,d);
 const belongs=e=>(e.line||orders.find(o=>o.id===e.sourceId)?.line)===line;
 for(const e of effectiveAttendance(events,true).filter(e=>['absence','line-absence'].includes(e.kind)&&e.absenceType==='Phụ kho'&&belongs(e)&&Date.parse(e.effectiveAt)<end&&Date.parse(e.endsAt)>start)){
  if(e.approved===false){issues.add('Có phụ kho chờ duyệt');continue;}
  if(!e.employees?.length){issues.add('Phụ kho chưa có tên nhân viên');continue;}
  const a=Math.max(start,Date.parse(e.effectiveAt)),b=Math.min(end,Date.parse(e.endsAt));
  for(let minute=Math.floor(a/60000)*60000;minute<b;minute+=60000){
   const local=new Date(minute+7*3600000),date=local.toISOString().slice(0,10),day=dates.get(date),at=local.getUTCHours()*60+local.getUTCMinutes();
   if(!day){issues.add(`Thiếu lịch thực tế: ${date}`);continue;}
   if(!workingAt(day,at))continue;
   
   for(const id of e.employees){const key=String(id).toUpperCase();if(!sets.has(key))sets.set(key,new Map());const segments=sets.get(key);const before=segments.get(minute)||[];before.push([Math.max(a,minute),Math.min(b,minute+60000)]);segments.set(minute,before);}
  }
 }
 const hours=new Map();
 for(const [id,minutes] of sets){let ms=0;for(const intervals of minutes.values()){intervals.sort((a,b)=>a[0]-b[0]);let [a,b]=intervals[0];for(const [x,y]of intervals.slice(1)){if(x<=b)b=Math.max(b,y);else{ms+=b-a;a=x;b=y;}}ms+=b-a;}hours.set(id,ms/3600000);}
 return {hours,issues:[...issues]};
}
// Largest remainder: integer VND allocations conserve the exact available fund.
export function distributeMoney(total,rows){
 const weight=rows.reduce((n,r)=>n+r.weight,0);
 if(!weight)return new Map(rows.map(r=>[r.id,0]));
 const parts=rows.map(r=>{const raw=total*r.weight/weight;return {...r,amount:Math.floor(raw),fraction:raw-Math.floor(raw)};});
 let remaining=total-parts.reduce((n,r)=>n+r.amount,0);
 for(const r of [...parts].sort((a,b)=>b.fraction-a.fraction||String(a.id).localeCompare(String(b.id))))if(remaining-->0)r.amount++;
 return new Map(parts.map(r=>[r.id,r.amount]));
}
export function payrollEligibility(person,month){
 const line=String(person.line||'').trim().toUpperCase();
 const start=person.startDate,end=person.endDate;
 if(!validEmploymentDate(start))return {kind:'missing',reason:'Thiếu ngày bắt đầu hợp lệ',eligibleFrom:null};
 if(end&&(!validEmploymentDate(end)||end<=start))return {kind:'missing',reason:'Ngày ngưng làm việc không hợp lệ',eligibleFrom:null};
 if(!['A','B','C'].includes(line))return {kind:'missing',reason:'Thiếu line gốc hợp lệ',eligibleFrom:null};
 const eligible=new Date(`${start.slice(0,7)}-01T00:00:00Z`);
 eligible.setUTCMonth(eligible.getUTCMonth()+(Number(start.slice(8))<=10?1:2));
 const eligibleFrom=eligible.toISOString().slice(0,10);
 if(line==='C')return {kind:'return',reason:'Line C: hoàn quỹ công ty',eligibleFrom};
 if(end&&end.slice(0,7)<=month)return {kind:'redistribute',reason:'Ngưng làm việc chưa đủ tháng: chia lại trong line',eligibleFrom};
 if(month<eligibleFrom.slice(0,7))return {kind:'redistribute',reason:'Chưa đến tháng hưởng: chia lại trong line',eligibleFrom};
 return {kind:'eligible',reason:'Đủ điều kiện nhận',eligibleFrom};
}
export function payrollPreview(earned,people,baseFund,blocking=[],month=''){
 const issues=[...blocking];let actual=0,helper=0,otherWork=0;
 const eligibility=new Map();
 for(const p of people){const hc=nonNegative(p.hc),ot=nonNegative(p.ot),support=nonNegative(p.helper),other=nonNegative(p.otherWork??0);
  if(hc===null||ot===null){issues.push(`Thiếu giờ lịch hoặc vắng mặt: ${p.name}`);continue;}
  if(hc+ot>744||support===null||other===null||support+other>hc+ot+1e-9){issues.push(`Giờ không hợp lệ: ${p.name}`);continue;}
  actual+=hc+ot;helper+=support;otherWork+=other;
  const status=month?payrollEligibility(p,month):{kind:'eligible',reason:'Đủ điều kiện nhận',eligibleFrom:null};
  eligibility.set(p.id,status);
  if(status.kind==='missing'&&hc+ot>0)issues.push(`${status.reason}: ${p.name||p.id}`);
 }
 const fund=nonNegative(baseFund),standard=nonNegative(earned),production=actual-helper-otherWork;
 if(!people.length)issues.push('Chưa chọn nhân viên tham gia');
 if(fund===null&&!blocking.length||fund!==null&&!Number.isSafeInteger(fund))issues.push('Quỹ gốc phải là số tiền nguyên không âm');
 if(standard===null)issues.push('Chưa đủ giờ công chuẩn hoàn thành');
 if(production<=0)issues.push('Giờ SX phải lớn hơn 0');
 const empty=()=>({issues:[...new Set(issues)],actual,helper,otherWork,production,score:null,factor:null,fund:null,paid:null,unallocated:null,returned:null,redistributed:null,payments:new Map(),details:new Map(),eligibility});
 if(issues.length)return empty();
 const score=standard/production*100,factor=efficiencyFactor(score),payFund=Math.round(fund*factor);
 const weights=people.map(p=>({id:p.id,weight:Number(p.hc)+Number(p.ot)}));
 const initial=distributeMoney(payFund,weights);
 let returned=0,redistributed=0;
 for(const p of people){const kind=eligibility.get(p.id).kind;if(kind==='return')returned+=initial.get(p.id);if(kind==='redistribute')redistributed+=initial.get(p.id);}
 const eligible=weights.filter(p=>eligibility.get(p.id).kind==='eligible'&&p.weight>0);
 if(redistributed>0&&!eligible.length){issues.push('Không có nhân viên đủ điều kiện để chia lại quỹ');return empty();}
 const extra=distributeMoney(redistributed,eligible),payments=new Map(),details=new Map();
 for(const p of people){const status=eligibility.get(p.id),base=initial.get(p.id),additional=extra.get(p.id)||0,payment=status.kind==='eligible'?base+additional:0;
  payments.set(p.id,payment);details.set(p.id,{...status,base,additional,returned:status.kind==='return'?base:0,redistributed:status.kind==='redistribute'?base:0,weight:(Number(p.hc)+Number(p.ot))/actual,payment});
 }
 const paid=[...payments.values()].reduce((a,b)=>a+b,0);
 return {issues:[],actual,helper,otherWork,production,score,factor,fund:payFund,paid,unallocated:fund-payFund,returned,redistributed,payments,details,eligibility};
}

// Split the shared monthly fund before applying each line's efficiency coefficient.
/** @param {number|string|null} [baseFund] */
export function allocateLineFunds(earnedA,earnedB,baseFund=6000000){
 const a=nonNegative(earnedA),b=nonNegative(earnedB),fund=nonNegative(baseFund);
 if(a===null||b===null||fund===null||!Number.isSafeInteger(fund))return {issues:['Chưa đủ dữ liệu phân bổ quỹ hai Line'],total:null,lines:[]};
 const total=a+b;
 if(total<=0)return {issues:['Chưa có giờ công hoàn thành để phân bổ quỹ'],total,lines:[]};
 const raw=[a/total*fund,b/total*fund],amounts=raw.map(Math.floor);
 let remaining=fund-amounts.reduce((x,y)=>x+y,0);
 for(const i of [0,1].sort((x,y)=>(raw[y]-amounts[y])-(raw[x]-amounts[x])||x-y))if(remaining-->0)amounts[i]++;
 return {issues:[],total,lines:[{line:'A',earned:a,ratio:a/total,allocated:amounts[0]},{line:'B',earned:b,ratio:b/total,allocated:amounts[1]}]};
}
