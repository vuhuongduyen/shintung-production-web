import {capacityWindowAdjustment} from './capacity-transfers.mjs';
import {monday,weekEnd,dateISO} from './production-plan.mjs';
export const capDays=week=>Array.from({length:7},(_,i)=>{const d=new Date(monday(week)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
export function newCapacity(week,line,factor=95){return {schemaVersion:1,week:monday(week),line,status:'Nháp',version:0,editCount:0,history:[],input:{leaveMode:'counted',hcLeaveMode:'rows',otLeaveMode:'rows',hcLeaveRows:[],otLeaveRows:[],hcLeaveTotal:0,otLeaveTotal:0,workers:0,hcHours:8,breakMinutes:20,cleanMinutes:60,cleanDay:5,otEnabled:false,otWorkers:0,otWorkersDefault:true,otHours:3.5,factor,workDays:[true,true,true,true,true,true,false],holidays:[],hcSlots:'',breakStart:'',cleanStart:'',otStart:'',otDays:Array.from({length:7},()=>({enabled:false,workers:null,hours:null})),hcLeaves:[],otLeaves:[]}};}
export function newDailyCapacity(week,line,factor=95){const row=newCapacity(week,line,factor);row.input={...row.input,hcSlots:'08:00-12:00,13:00-17:00',breakStart:'10:00',otStart:'17:30',dailySchedule:capDays(week).map((date,i)=>({date,working:i<6,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],cleaning:[],ot:false,otWorkers:null,otStart:'17:30',otEnd:'21:00'})),dailyHcLeave:[],dailyOtLeave:[],otherTime:[]};return row;}
export const linkedOtLeaveDates=(leave,schedule)=>leave.includeOt?(schedule||[]).filter(day=>day.working&&day.ot&&day.date>=(leave.otFrom||leave.date)&&day.date<=(leave.otTo||leave.otFrom||leave.date)&&day.date>=leave.date&&day.date<=(leave.to||leave.date)).map(day=>day.date):[];
// Display the staff who actually attend a day, while retaining partial leave
// employees with a visible interval. Stored rosters are never modified here.
export function dailyParticipants(input,index){
 const day=input.dailySchedule?.[index],date=day?.date,roster=input.dailyRoster?.[index];
 if(!day)return {hc:[],ot:[],hcCount:0,otCount:0,hasNames:false,partialHc:[],partialOt:[]};
 const hcLeave=(input.dailyHcLeave||[]).filter(x=>x.date<=date&&(x.to||x.date)>=date);
 const otLeave=(input.dailyOtLeave||[]).filter(x=>x.date<=date&&(x.to||x.date)>=date);
 const fullHc=new Set(hcLeave.filter(x=>x.mode==='full').flatMap(x=>x.employees||[]));
 const fullOt=new Set([...otLeave.filter(x=>x.mode==='full'||x.mode==='attended'&&Number(x.hours)===0),...hcLeave.filter(x=>linkedOtLeaveDates(x,input.dailySchedule).includes(date)&&(x.otMode||'full')==='full')].flatMap(x=>x.employees||[]));
 const partialHc=hcLeave.filter(x=>x.mode==='hours'),partialOt=[...otLeave.filter(x=>x.mode==='hours'||x.mode==='attended'&&Number(x.hours)>0),...hcLeave.filter(x=>linkedOtLeaveDates(x,input.dailySchedule).includes(date)&&x.otMode==='hours').map(x=>({...x,start:x.otStart,end:x.otEnd}))];
 const hc=day.working&&roster?roster.hc.filter(id=>!fullHc.has(id)):[];
 const ot=day.ot&&roster?roster.ot.filter(id=>!fullOt.has(id)):[];
 return {hc,ot,hasNames:Boolean(roster),partialHc,partialOt,
  hcCount:day.working?(roster?hc.length:Math.max(0,Number(input.workers||0)-hcLeave.filter(x=>x.mode==='full').reduce((s,x)=>s+Number(x.people||0),0))):0,
  otCount:day.ot?(roster?ot.length:Math.max(0,Number(day.otWorkers??input.otWorkers??input.workers??0)-otLeave.filter(x=>x.mode==='full'||x.mode==='attended'&&Number(x.hours)===0).reduce((s,x)=>s+Number(x.people||0),0)-hcLeave.filter(x=>linkedOtLeaveDates(x,input.dailySchedule).includes(date)&&(x.otMode||'full')==='full').reduce((s,x)=>s+Number(x.people||0),0))):0};
}
const num=(v,name,max=100000)=>{if(v===''||v===null||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>max)throw Error(`${name}: giá trị không hợp lệ / Invalid value`);return Number(v);};
const count=(v,name)=>{const n=num(v,name,10000);if(!Number.isInteger(n))throw Error(`${name}: phải là số nguyên / Whole number required`);return n;};
const minute=v=>{if(!/^\d{2}:\d{2}$/.test(v||''))throw Error('Cần cấu hình giờ thực tế / Configure actual time');const [h,m]=v.split(':').map(Number);if(h>23||m>59)throw Error('Giờ không hợp lệ / Invalid time');return h*60+m;};
const union=xs=>{const out=[];for(const [a,b] of xs.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0])){if(out.length&&a<=out.at(-1)[1])out.at(-1)[1]=Math.max(b,out.at(-1)[1]);else out.push([a,b]);}return out;};
const length=xs=>union(xs).reduce((n,[a,b])=>n+b-a,0);
const intersect=(xs,ys)=>xs.flatMap(([a,b])=>ys.map(([c,d])=>[Math.max(a,c),Math.min(b,d)]).filter(([a,b])=>b>a));
const slots=s=>s.split(',').filter(Boolean).map(v=>{const [a,b]=v.trim().split('-');const x=minute(a),y=minute(b);if(y<=x)throw Error('Khung giờ phải cùng ngày, giờ kết thúc sau bắt đầu / Invalid interval');return [x,y];});
export function calculateCapacity(input,week){
 if(!dateISO(week)||monday(week)!==week)throw Error('Tuần phải bắt đầu thứ Hai / Week must start Monday');
 if(Array.isArray(input.dailySchedule))return calculateDailyCapacity(input,week);
 if(input.leaveMode==='counted'){
  const hcMode=input.hcLeaveMode,otMode=input.otLeaveMode;
  if(!['rows','aggregate','legacy'].includes(hcMode)||!['rows','aggregate','legacy'].includes(otMode))throw Error('Hình thức ghi nhận nghỉ không hợp lệ / Invalid leave mode');
  const hcLeaves=hcMode==='rows'?expandCountedLeaves(input,'hc',week):hcMode==='legacy'?input.hcLeaves:[];
  const otLeaves=otMode==='rows'?expandCountedLeaves(input,'ot',week):otMode==='legacy'?input.otLeaves:[];
  const base=calculateCapacity({...input,leaveMode:'detailed',hcLeaves,otLeaves},week);
  const hcExtra=hcMode==='aggregate'?num(input.hcLeaveTotal,'Tổng giờ nghỉ HC',base.hcHours):0;
  const otExtra=otMode==='aggregate'?num(input.otLeaveTotal,'Tổng giờ nghỉ tăng ca',base.otHours):0;
  const hcHours=base.hcHours-hcExtra,otHours=base.otHours-otExtra;
  return {...base,leaveMode:'counted',hcHours,otHours,hcLeaveHours:base.hcLeaveHours+hcExtra,otLeaveHours:base.otLeaveHours+otExtra,availableHours:(hcHours+otHours)*Number(input.factor)/100,hasUnallocatedLeave:hcMode==='aggregate'||otMode==='aggregate'};
 }
 if(input.leaveMode==='aggregate'){
  // Total leave is production-impact person-hours, excluding breaks/cleaning already deducted.
  // Retained employee detail is historical only and must not be subtracted a second time.
  const base=calculateCapacity({...input,leaveMode:'detailed',hcLeaves:[],otLeaves:[]},week);
  const hcLeaveHours=num(input.hcLeaveTotal,'Tổng giờ nghỉ HC',base.hcHours),otLeaveHours=num(input.otLeaveTotal,'Tổng giờ nghỉ tăng ca',base.otHours);
  const hcHours=base.hcHours-hcLeaveHours,otHours=base.otHours-otLeaveHours;
  return {days:base.days.map(({hcNet,otNet,hcLeave,otLeave,...day})=>({...day,hcBeforeLeave:hcNet,otBeforeLeave:otNet})),leaveMode:'aggregate',hcHours,otHours,availableHours:(hcHours+otHours)*Number(input.factor)/100,hcLeaveHours,otLeaveHours,hcPeople:null,otPeople:null};
 }

 const p=input,days=capDays(week),workers=count(p.workers,'Người HC'),hc=num(p.hcHours,'Giờ HC',24)*60,br=num(p.breakMinutes,'Giải lao',1440),cl=num(p.cleanMinutes,'Vệ sinh',1440),factor=num(p.factor,'Hệ số',1000)/100;
 count(p.otWorkers,'Người TC');num(p.otHours,'Giờ TC',24);
 if(!Array.isArray(p.workDays)||p.workDays.length!==7||!Array.isArray(p.otDays)||p.otDays.length!==7||!Array.isArray(p.holidays)||!Array.isArray(p.hcLeaves)||!Array.isArray(p.otLeaves))throw Error('Lịch không hợp lệ / Invalid schedule');
 if(!Number.isInteger(p.cleanDay)||p.cleanDay<0||p.cleanDay>6)throw Error('Ngày vệ sinh không hợp lệ');
 for(const d of p.holidays)if(!days.includes(d))throw Error('Ngày nghỉ lễ ngoài tuần / Holiday outside week');
 const hcLeaves=p.hcLeaves,otLeaves=p.otLeaves;
 for(const l of [...hcLeaves,...otLeaves])if(!Array.isArray(l.employees)||!l.employees.length||l.employees.some(e=>!String(e).trim())||new Set(l.employees).size!==l.employees.length)throw Error('Chọn nhân viên / Select employees');
 for(const l of hcLeaves)if(!days.includes(l.from)||!days.includes(l.to)||l.to<l.from||!['full','hours'].includes(l.mode))throw Error('Khoảng nghỉ HC ngoài tuần hoặc không hợp lệ / Invalid leave dates');
 for(const l of otLeaves)if(!days.includes(l.date)||!['full','absent','attended','interval'].includes(l.mode))throw Error('Nghỉ TC ngoài tuần hoặc không hợp lệ / Invalid overtime leave');
 const hcSet=new Set(),otSet=new Set();let hcImpact=0,otImpact=0;
 const result=days.map((date,i)=>{
  const working=Boolean(p.workDays[i])&&!p.holidays.includes(date),clean=working&&i===p.cleanDay?cl:0;
  const dailyHc=working?hc:0;
  const leaves=working?hcLeaves.filter(l=>l.from<=date&&l.to>=date):[];
  const byPerson=new Map();for(const l of leaves)for(const e of l.employees){hcSet.add(e);byPerson.set(e,[...(byPerson.get(e)||[]),l]);}
  if(byPerson.size>workers)throw Error(`${date}: người nghỉ HC vượt Người HC / Too many absent employees`);
  let baseLoss=working?br+clean:0,extra=0;
  const partial=leaves.some(l=>l.mode==='hours');
  let work=[],excluded=[];
  if(working&&(p.hcSlots||partial)){
   work=union(slots(p.hcSlots));if(Math.abs(length(work)-hc)>0.001)throw Error(`${date}: tổng khung giờ HC phải bằng Giờ HC / Working intervals must match hours`);
   for(const [duration,start,label] of [[br,p.breakStart,'giải lao'],[clean,p.cleanStart,'vệ sinh']])if(duration){const a=minute(start);const range=[[a,a+duration]];if(Math.abs(length(intersect(range,work))-duration)>1e-7)throw Error(`${date}: khung ${label} phải nằm trong giờ HC`);excluded.push(...range);}
   excluded=union(excluded);baseLoss=length(excluded);
  }
  if(baseLoss>dailyHc)throw Error(`${date}: giải lao/vệ sinh vượt giờ HC / Deductions exceed working hours`);
  for(const lists of byPerson.values()){
   if(lists.some(l=>l.mode==='full'))extra+=dailyHc-baseLoss;
   else {const absent=lists.flatMap(l=>{const a=minute(l.start),b=minute(l.end);if(b<=a)throw Error('Giờ nghỉ HC không hợp lệ / Invalid leave interval');return intersect([[a,b]],work);});extra+=length([...excluded,...absent])-baseLoss;}
  }
  hcImpact+=extra;
  const ot=p.otDays[i],enabled=Boolean(p.otEnabled&&ot.enabled),people=enabled?count(ot.workers??p.otWorkers,'Người TC'):0,hours=enabled?num(ot.hours??p.otHours,'Giờ TC',24):0;
  const registrations=otLeaves.filter(l=>l.date===date),cross=hcLeaves.filter(l=>l.otFull&&l.from<=date&&l.to>=date);
  if(!enabled&&registrations.length)throw Error(`${date}: còn đăng ký nghỉ TC, hãy xử lý trước khi bỏ lịch / Resolve overtime leave before disabling day`);
  const losses=new Map();
  if(enabled){for(const l of cross)for(const e of l.employees){losses.set(e,hours);otSet.add(e);}
   for(const l of registrations)for(const e of l.employees){if(losses.has(e))throw Error(`${date}: ${e} đã có đăng ký nghỉ TC / Duplicate overtime leave`);
    let loss=hours;if(l.mode==='absent')loss=num(l.hours,'Giờ nghỉ',hours);if(l.mode==='attended')loss=hours-num(l.hours,'Giờ tham gia',hours);
    if(l.mode==='interval'){const a=minute(l.start),b=minute(l.end),start=minute(p.otStart);if(b<=a||a<start||b>start+hours*60)throw Error(`${date}: giờ nghỉ nằm ngoài lịch TC / Leave outside overtime`);loss=(b-a)/60;}
    losses.set(e,loss);otSet.add(e);
   }
  }
  if(losses.size>people)throw Error(`${date}: số người nghỉ TC vượt nhân lực TC / Too many overtime absences`);
  const otLoss=[...losses.values()].reduce((a,b)=>a+b,0),hcNet=(workers*(dailyHc-baseLoss)-extra)/60,otNet=people*hours-otLoss;
  if(hcNet < -1e-8 || otNet < -1e-8)throw Error('Giờ khả dụng âm / Negative capacity');
  otImpact+=otLoss;return {date,working,hcGross:workers*dailyHc/60,hcLeave:extra/60,hcNet:Math.max(0,hcNet),otGross:people*hours,otLeave:otLoss,otNet:Math.max(0,otNet)};
 });
 const hcHours=result.reduce((n,d)=>n+d.hcNet,0),otHours=result.reduce((n,d)=>n+d.otNet,0);
 return {days:result,hcHours,otHours,availableHours:(hcHours+otHours)*factor,hcLeaveHours:hcImpact/60,otLeaveHours:otImpact,hcPeople:hcSet.size,otPeople:otSet.size};
}
// Present both retained aggregate weeks and new daily weeks in the same
// summary columns without changing the persisted input or inventing names.
export function capacitySummaryNumbers(input,result){
 const sum=key=>(result.days||[]).reduce((n,day)=>n+Number(day[key]||0),0);
 const hcGross=sum('hcGross'),otGross=sum('otGross');
 const hcLeave=Number(result.hcLeaveHours||0),otLeave=Number(result.otLeaveHours||0);
 const oldDeductions=Math.max(0,hcGross-hcLeave-Number(result.hcHours||0));
 const cleanIndex=Number(input.cleanDay),dates=Array.isArray(input.workDays)?input.workDays:[];
 const scheduledClean=dates[cleanIndex]&&!input.holidays?.includes(result.days?.[cleanIndex]?.date)?Number(input.workers||0)*Number(input.cleanMinutes||0)/60:0;
 const clean=Array.isArray(input.dailySchedule)?Number(result.cleanHours||0):Math.min(oldDeductions,Math.max(0,scheduledClean));
 const breaks=Array.isArray(input.dailySchedule)?Number(result.breakHours||0):Math.max(0,oldDeductions-clean);
 return {hcGross,hcLeave,breaks,clean,otherHc:Number(result.otherHcHours||0),hcNet:Number(result.hcHours||0),otGross,otLeave,otherOt:Number(result.otherOtHours||0),otNet:Number(result.otHours||0),available:Number(result.availableHours||0)};
}
// The day-based model is opt-in for existing records: records without dailySchedule
// continue to use the historical formula above, without rewriting their inputs.
function calculateDailyCapacity(p,week){
 const dates=capDays(week),basePeople=count(p.workers,'Người HC'),factor=num(p.factor,'Hệ số',1000)/100;
 if(p.dailySchedule.length!==7||p.dailySchedule.some((d,i)=>d.date!==dates[i]))throw Error('Lịch ngày phải đủ bảy ngày của tuần được chọn');
 const enteredHcLeave=(Array.isArray(p.dailyHcLeave)?p.dailyHcLeave:[]).filter(x=>!isBlankDailyRow(x));
 const hcLeave=enteredHcLeave.flatMap(x=>{
  const from=x.date,to=x.to||from;
  if(!dates.includes(from)||!dates.includes(to)||to<from)throw Error('Ngày nghỉ HC phải thuộc tuần kế hoạch / Leave must be within plan week');
  if(x.mode==='hours'&&to!==from)throw Error('Nghỉ theo giờ chỉ áp dụng trong một ngày / Hourly leave is one day');
  if(x.includeOt){
   const otFrom=x.otFrom||from,otTo=x.otTo||otFrom;
   if(x.mode!=='full'||!dates.includes(otFrom)||!dates.includes(otTo)||otFrom<from||otTo>to||otTo<otFrom)throw Error('Khoảng nghỉ TC phải nằm trong ngày nghỉ HC cả ngày / Linked OT range must fit full-day HC leave');
   if(!['full','hours'].includes(x.otMode||'full'))throw Error('Hình thức nghỉ TC không hợp lệ / Invalid linked OT leave mode');
   if(!linkedOtLeaveDates(x,p.dailySchedule).length)throw Error(`${from}: nghỉ cả tăng ca cần lịch tăng ca trong khoảng đã chọn`);
  }
  if(!p.dailySchedule.some(day=>day.date>=from&&day.date<=to&&day.working))throw Error(`${from}: ngày nghỉ có dữ liệu HC; không có ngày làm việc / No scheduled work`);
  return dates.filter(d=>d>=from&&d<=to).map(date=>({...x,date}));
 });
 const enteredOtLeave=(Array.isArray(p.dailyOtLeave)?p.dailyOtLeave:[]).filter(x=>!isBlankDailyRow(x));
 const otLeave=enteredOtLeave.flatMap(x=>{const to=x.to||x.date;if(!dates.includes(x.date)||!dates.includes(to)||to<x.date)throw Error('Khoảng nghỉ TC phải thuộc tuần kế hoạch / OT leave must be within plan week');const active=dates.filter(date=>date>=x.date&&date<=to&&p.dailySchedule.some(day=>day.date===date&&day.working&&day.ot));if(!active.length)throw Error(`${x.date}: không có lịch tăng ca trong khoảng đăng ký nghỉ`);return active.map(date=>({...x,date}));});
 const other=(Array.isArray(p.otherTime)?p.otherTime:[]).filter(x=>!isBlankDailyRow(x));
 for(const x of other)if(!dates.includes(x.date))throw Error('Ngày đăng ký phải thuộc tuần kế hoạch / Date outside plan week');
 const intervals=(a,b,name)=>{const x=minute(a),y=minute(b);if(y<=x)throw Error(`${name}: thời gian kết thúc phải sau bắt đầu`);return [[x,y]];};
 const overlap=(a,b)=>length(intersect(a,b));
 const inSchedule=(range,work,name)=>{if(overlap(range,work)!==length(range))throw Error(`${name}: thời gian phải nằm trong khung làm việc`);};
 let hcLeaveHours=0,otLeaveHours=0,breakHours=0,cleanHours=0,otherHcHours=0,otherOtHours=0;
 const days=p.dailySchedule.map((day,index)=>{
  const date=dates[index],working=Boolean(day.working),ot=Boolean(day.ot);
  const roster=p.dailyRoster?.[index];
  if(p.dailyRoster&&(!roster||roster.date!==date||!Array.isArray(roster.hc)||!Array.isArray(roster.ot)))throw Error(`${date}: lịch nhân viên không hợp lệ`);
  const people=roster?roster.hc.length:basePeople;
  if(!working&&ot)throw Error(`${date}: ngày không làm HC không được lên lịch tăng ca`);
  const lunch=intervals(day.lunchStart,day.lunchEnd,`${date} nghỉ trưa`);
  const gross=intervals(day.hcStart,day.hcEnd,`${date} HC`);
  inSchedule(lunch,gross,`${date} nghỉ trưa`);
  const work=working?union([[gross[0][0],lunch[0][0]],[lunch[0][1],gross[0][1]]]):[];
  const breakRanges=working?(day.breaks||[]).map(b=>intervals(b.start,b.end,`${date} giải lao`)[0]):[];
  for(const b of breakRanges)inSchedule([b],work,`${date} giải lao`);
  if(length(breakRanges)!==breakRanges.reduce((s,b)=>s+b[1]-b[0],0))throw Error(`${date}: các giờ giải lao không được chồng nhau`);
  const dayHcLeave=working?hcLeave.filter(x=>x.date===date):[],dayOther=other.filter(x=>x.date===date);
  if(roster){for(const x of dayHcLeave){if(!Array.isArray(x.employees)||!x.employees.length||new Set(x.employees).size!==x.employees.length||x.employees.some(id=>!roster.hc.includes(id)))throw Error(`${date}: chọn tên người nghỉ HC đang được phân công tại Line`);if(Number(x.people)!==x.employees.length)throw Error(`${date}: số người nghỉ HC phải bằng số tên đã chọn`);}}
  const linkedOtLeave=enteredHcLeave.filter(x=>linkedOtLeaveDates(x,p.dailySchedule).includes(date));
  if(!roster&&linkedOtLeave.length&&otLeave.some(x=>x.date===date))throw Error(`${date}: nghỉ cả tăng ca đã có dòng nghỉ TC; cần gộp để tránh trừ hai lần`);
  const dayOtLeave=[...otLeave.filter(x=>x.date===date),...linkedOtLeave.map(x=>({...x,date,mode:x.otMode||'full',start:x.otStart,end:x.otEnd}))];
  if(!working&&(dayHcLeave.length||dayOther.some(x=>x.part==='hc')||(day.cleaning||[]).length))throw Error(`${date}: ngày nghỉ có dữ liệu HC/vệ sinh; hãy xử lý trước khi bỏ lịch`);
  if(!ot&&(dayOtLeave.length||dayOther.some(x=>x.part==='ot')))throw Error(`${date}: còn đăng ký tăng ca; hãy xử lý trước khi bỏ lịch`);
  const full=dayHcLeave.filter(x=>x.mode==='full').reduce((s,x)=>s+count(x.people,'Số người nghỉ HC'),0),partial=dayHcLeave.filter(x=>x.mode==='hours');
  const partialCount=partial.reduce((s,x)=>s+count(x.people,'Số người nghỉ HC'),0);
  if(full+partialCount>people)throw Error(`${date}: số người nghỉ HC vượt nhân lực; tách nhóm người không trùng`);
  const leaveFull=full*length(work)/60;
  let leavePartial=0;
  const partialRanges=partial.map(x=>{const range=intervals(x.start,x.end,`${date} nghỉ HC`);inSchedule(range,work,`${date} nghỉ HC`);const n=count(x.people,'Số người nghỉ HC');leavePartial+=n*(length(range)-overlap(range,breakRanges))/60;return range[0];});
  // Partial leave is already net of breaks. Keep those break minutes here so
  // each non-working minute is deducted exactly once, including overlaps.
  let breakActual=(people-full)*length(breakRanges)/60;
  const cleaning=(day.cleaning||[]).filter(x=>String(x.people??'').trim()||x.employees?.length);let clean=0,cleanRanges=[];
  const countOnlyCleaning=cleaning.some(c=>!Array.isArray(c.employees)||!c.employees.length);
  // For numbered groups, the group totals reserve distinct HC staff for the day.
  // Old named groups retain their recorded names and the existing overlap rules.
  if(countOnlyCleaning&&cleaning.reduce((sum,c)=>sum+count(c.people,'Số người vệ sinh'),0)>people-full)throw Error(`${date}: tổng số người vệ sinh vượt số người HC tham gia ngày này`);
  for(const c of cleaning){
   const n=count(c.people,'Số người vệ sinh'),range=intervals(c.start,c.end,`${date} vệ sinh`);
   const named=Array.isArray(c.employees)&&c.employees.length>0;
   if(roster&&named&&(c.employees.length!==n||new Set(c.employees).size!==n||c.employees.some(id=>!roster.hc.includes(id)||dayHcLeave.some(l=>l.mode==='full'&&l.employees?.includes(id)))))throw Error(`${date}: chọn đúng tên nhân viên vệ sinh theo Line`);
   if(n>people-full)throw Error(`${date}: số người vệ sinh vượt người có mặt`);
   inSchedule(range,work,`${date} vệ sinh`);
   if(overlap(range,breakRanges))throw Error(`${date}: vệ sinh trùng giải lao; hãy sửa khung giờ`);
   if(named&&partialRanges.some(x=>overlap(range,[x])&&dayHcLeave.some(l=>l.mode==='hours'&&l.employees?.some(id=>c.employees.includes(id)))))throw Error(`${date}: vệ sinh trùng nghỉ theo giờ của nhân viên`);
   if(cleanRanges.some(x=>overlap(range,[x.range])&&named&&Array.isArray(x.employees)&&x.employees.length&&x.employees.some(id=>c.employees.includes(id))))throw Error(`${date}: hai nhóm vệ sinh trùng giờ của cùng nhân viên`);
   clean+=n*length(range)/60;cleanRanges.push({range:range[0],employees:named?c.employees:null,people:n});
  }
  if(countOnlyCleaning&&cleanRanges.length){
   const points=[...new Set([...cleanRanges.flatMap(x=>x.range),...partialRanges.flatMap(x=>x)])].sort((a,b)=>a-b);
   for(let i=0;i<points.length-1;i++){
    const at=points[i];
    const cleaningAt=cleanRanges.filter(x=>x.range[0]<=at&&at<x.range[1]).reduce((sum,x)=>sum+x.people,0);
    const absentAt=partial.filter((_,j)=>partialRanges[j][0]<=at&&at<partialRanges[j][1]).reduce((sum,x)=>sum+Number(x.people),0);
    if(cleaningAt+absentAt>people-full)throw Error(`${date}: người vệ sinh và nghỉ theo giờ vượt số người HC có mặt cùng thời điểm`);
   }
  }
  const otWindow=ot?intervals(day.otStart,day.otEnd,`${date} tăng ca`):[],otWorkers=ot?(roster?roster.ot.length:count(day.otWorkers??p.otWorkers??people,'Số người tăng ca')):0;
  if(ot&&otWindow[0][0]<gross[0][1]+30)throw Error(`${date}: tăng ca phải bắt đầu sau khoảng nghỉ 17:00–17:30`);
  let otLoss=0,otLeaveCount=0;
  const seenOt=new Set();for(const x of dayOtLeave){const n=count(x.people,'Số người nghỉ TC');if(roster){if(!Array.isArray(x.employees)||x.employees.length!==n||x.employees.some(id=>!roster.ot.includes(id)||seenOt.has(id)))throw Error(`${date}: tên người nghỉ tăng ca trùng hoặc không có trong lịch`);x.employees.forEach(id=>seenOt.add(id));}otLeaveCount+=n;const fullOt=length(otWindow)/60;let loss=fullOt;if(x.mode==='hours'){const range=intervals(x.start,x.end,`${date} nghỉ TC`);inSchedule(range,otWindow,`${date} nghỉ TC`);loss=length(range)/60;}else if(x.mode==='attended')loss=fullOt-num(x.hours,'Giờ tham gia',fullOt);else if(x.mode!=='full')throw Error(`${date}: hình thức nghỉ TC không hợp lệ`);otLoss+=n*loss;}
  if(otLeaveCount>otWorkers)throw Error(`${date}: số người nghỉ TC vượt số người tăng ca`);
  let otherHc=0,otherOt=0;const otherRanges={hc:[],ot:[]};
  for(const x of dayOther){if(!String(x.reason||'').trim())throw Error(`${date}: chọn loại thời gian khác`);if(x.description!==undefined&&!String(x.description||'').trim())throw Error(`${date}: nhập nội dung thời gian khác`);const n=count(x.people,'Số người thời gian khác'),range=intervals(x.start,x.end,`${date} thời gian khác`);if(roster&&(!Array.isArray(x.employees)||x.employees.length!==n||x.employees.some(id=>!(x.part==='ot'?roster.ot:roster.hc).includes(id))))throw Error(`${date}: chọn tên nhân viên tham gia thời gian khác`);if(x.part==='hc'){
    if(n>people-full)throw Error(`${date}: số người thời gian khác HC vượt người có mặt`);inSchedule(range,work,`${date} thời gian khác HC`);
    if(overlap(range,breakRanges)||partialRanges.some(y=>overlap(range,[y]))||cleanRanges.some(y=>overlap(range,[y.range])&&(!roster||!Array.isArray(y.employees)||y.employees.some(id=>x.employees.includes(id))))||otherRanges.hc.some(y=>overlap(range,[y])))throw Error(`${date}: thời gian khác trùng nghỉ/giải lao/vệ sinh hoặc dòng khác; cần điều chỉnh hoặc xác định rõ người`);
    otherRanges.hc.push(range[0]);
    otherHc+=n*length(range)/60;
  }else if(x.part==='ot'){if(n>otWorkers-otLeaveCount)throw Error(`${date}: số người thời gian khác TC vượt người có mặt`);inSchedule(range,otWindow,`${date} thời gian khác TC`);if(otherRanges.ot.some(y=>overlap(range,[y]))||dayOtLeave.some(y=>y.mode==='hours'&&overlap(range,intervals(y.start,y.end,'Nghỉ TC'))))throw Error(`${date}: thời gian khác trùng nghỉ TC/dòng khác; cần xác định rõ người`);otherRanges.ot.push(range[0]);otherOt+=n*length(range)/60;}else throw Error(`${date}: chọn HC hoặc TC cho thời gian khác`);}
  let hcGross=people*length(work)/60,otGross=otWorkers*length(otWindow)/60,hcLeaveDay=leaveFull+leavePartial;
  const windowLoss=capacityWindowAdjustment(roster,day,work,breakRanges,dayHcLeave,dayOtLeave,cleaning,dayOther,otWindow);
  hcGross-=windowLoss.hcGross;otGross-=windowLoss.otGross;hcLeaveDay-=windowLoss.hcLeave;otLoss-=windowLoss.otLeave;breakActual-=windowLoss.breaks;clean-=windowLoss.clean;otherHc-=windowLoss.otherHc;otherOt-=windowLoss.otherOt;
  const hcNet=hcGross-breakActual-hcLeaveDay-clean-otherHc,otNet=otGross-otLoss-otherOt;
  if(hcNet < -1e-8||otNet < -1e-8)throw Error(`${date}: giờ khả dụng âm; kiểm tra số người và thời gian`);
  hcLeaveHours+=hcLeaveDay;otLeaveHours+=otLoss;breakHours+=breakActual;cleanHours+=clean;otherHcHours+=otherHc;otherOtHours+=otherOt;
  return {date,working,hcGross,hcLeave:hcLeaveDay,hcNet:Math.max(0,hcNet),otGross,otLeave:otLoss,otNet:Math.max(0,otNet),breakHours:breakActual,cleanHours:clean,otherHcHours:otherHc,otherOtHours:otherOt};
 });
 const hcHours=days.reduce((s,d)=>s+d.hcNet,0),otHours=days.reduce((s,d)=>s+d.otNet,0);
 return {days,hcHours,otHours,hcLeaveHours,otLeaveHours,breakHours,cleanHours,otherHcHours,otherOtHours,availableHours:(hcHours+otHours)*factor};
}
export function isBlankDailyRow(row){return !String(row?.people??'').trim()&&!(Array.isArray(row?.employees)&&row.employees.length)&&!String(row?.start||'').trim()&&!String(row?.end||'').trim()&&!String(row?.hours??'').trim()&&!String(row?.reason||row?.note||'').trim()&&!String(row?.description||'').trim();}
export function stripBlankDailyRows(input){if(!Array.isArray(input.dailySchedule))return input;return {...input,dailyHcLeave:(input.dailyHcLeave||[]).filter(x=>!isBlankDailyRow(x)),dailyOtLeave:(input.dailyOtLeave||[]).filter(x=>!isBlankDailyRow(x)),otherTime:(input.otherTime||[]).filter(x=>!isBlankDailyRow(x)),dailySchedule:input.dailySchedule.map(d=>({...d,cleaning:(d.cleaning||[]).filter(x=>!isBlankDailyRow(x))}))};}
export function capacityDiff(oldValue,newValue,path=''){const changes=[];if(JSON.stringify(oldValue)===JSON.stringify(newValue))return changes;if(oldValue&&newValue&&typeof oldValue==='object'&&typeof newValue==='object'){for(const k of new Set([...Object.keys(oldValue),...Object.keys(newValue)]))changes.push(...capacityDiff(oldValue[k],newValue[k],path?`${path}.${k}`:k));}else changes.push({field:path,old:oldValue??null,new:newValue??null});return changes;}

// Conversion happens only on an explicit edit/save, never by writing during a read.
export function aggregateCapacityInput(input,week){
 if(input.leaveMode==='aggregate')return {...input};
 const old=calculateCapacity(input,week);
 return {...input,leaveMode:'aggregate',hcLeaveTotal:old.hcLeaveHours,otLeaveTotal:old.otLeaveHours};
}

export const blankCountedLeave=()=>({id:'',people:'',from:'',to:'',mode:'full',start:'',end:'',hours:'',note:''});
export const isBlankCountedLeave=row=>!['people','from','to','start','end','hours','note'].some(k=>row[k]!==''&&row[k]!=null)&&(!row.mode||row.mode==='full');
export function countedLeaveMode(input,kind){return input.leaveMode==='counted'?input[kind+'LeaveMode']:input.leaveMode==='aggregate'?'aggregate':'legacy';}
export function withCountedLeaves(input,kind,rows){return {...input,leaveMode:'counted',hcLeaveMode:countedLeaveMode(input,'hc'),otLeaveMode:countedLeaveMode(input,'ot'),[kind+'LeaveMode']:'rows',[kind+'LeaveRows']:rows};}
function expandCountedLeaves(input,kind,week){
 const rows=input[kind+'LeaveRows'];if(!Array.isArray(rows)||rows.length>200)throw Error('Tối đa 200 dòng nghỉ / Maximum 200 leave rows');
 const days=capDays(week),perDay=days.map(()=>0),expanded=[];
 rows.forEach((row,index)=>{
  if(isBlankCountedLeave(row))return;
  const people=count(row.people,`Dòng ${index+1}: số người nghỉ`);if(!people)throw Error(`Dòng ${index+1}: số người nghỉ phải lớn hơn 0 / Headcount must be positive`);
  const to=row.to||row.from;
  if(!days.includes(row.from)||!days.includes(to)||to<row.from)throw Error(`Dòng ${index+1}: chọn ngày nghỉ trong tuần / Select leave dates within week`);
  const validModes=kind==='hc'?['full','hours']:['full','interval','absent','attended'];
  if(!validModes.includes(row.mode))throw Error('Hình thức nghỉ không hợp lệ / Invalid leave type');
  const activeDays=days.filter((date,i)=>date>=row.from&&date<=to&&(kind==='hc'?input.workDays[i]&&!input.holidays.includes(date):input.otEnabled&&input.otDays[i].enabled));
  if(!activeDays.length)throw Error(`Dòng ${index+1}: không có ngày làm việc ${kind==='ot'?'tăng ca':'HC'} trong khoảng đã chọn / No scheduled work in selected range`);
  for(const date of activeDays){const i=days.indexOf(date);perDay[i]+=people;const limit=kind==='hc'?Number(input.workers):Number(input.otDays[i].workers??input.otWorkers);if(perDay[i]>limit)throw Error(`${date}: số người nghỉ vượt nhân lực ${kind.toUpperCase()} / Leave headcount exceeds scheduled workers`);}
  const employees=Array.from({length:people},(_,i)=>`${kind}-row-${index}-${i}`);
  if(kind==='hc')expanded.push({...row,to,employees,otFull:false});
  else for(const date of activeDays)expanded.push({...row,date,employees});
 });
 return expanded;
}

// An unreviewed confirmation is still a draft baseline, even for a past week.
export function capacityHasAcceptedVersion(row) {
 return Boolean(row?.khsxAcceptedAt || ['approved','adjust-pending','adjust-approved','adjusting'].includes(row?.reviewStatus) || (row?.history||[]).some(h=>h.action==='review'&&h.decision==='approve'&&h.request?.kind==='capacity'));
}

// Registration check, independent of net cleaning deductions after leave.
export function hasCapacityCleaning(input,week){
 if(Array.isArray(input.dailySchedule))return input.dailySchedule.some(day=>day.working&&(day.cleaning||[]).some(group=>Number(group.people)>0&&group.start&&group.end&&group.end>group.start));
 const day=Number(input.cleanDay);
 return Number(input.cleanMinutes)>0&&Boolean(input.workDays?.[day])&&!(input.holidays||[]).includes(capDays(week)[day]);
}
