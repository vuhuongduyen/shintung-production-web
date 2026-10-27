const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const fundHistoryStart='2026-10';
export const fundHistoryNote='Số tiền dự tính theo dữ liệu hiện tại, chưa xác nhận đã chi. Quỹ mặc định 6.000.000 đồng/tháng; thay đổi quỹ và lựa chọn NV chỉ áp dụng trong lần mở menu này.';
export function payrollFundHistory({from,to,calculate}){
 const empty=error=>({from,to,error,rows:[],companyRows:[],totals:{},completeMonths:0,monthCount:0});
 if(!validMonth(from)||!validMonth(to)||from>to)return empty('Chọn khoảng tháng hợp lệ: Từ tháng không được sau Đến tháng.');
 from=from<fundHistoryStart?fundHistoryStart:from;
 if(to<fundHistoryStart)return empty('Theo dõi quỹ từ tháng 10/2026.');
 const index=value=>Number(value.slice(0,4))*12+Number(value.slice(5))-1;
 const count=index(to)-index(from)+1;
 if(count>24)return empty('Mỗi lần xem tối đa 24 tháng.');
 const rows=[],companyRows=[],running={},totals={allocated:0,paid:0,unallocated:0,returned:0,retained:0,remaining:0};let completeMonths=0,companyCumulative=0;
 for(let i=index(from);i<=index(to);i++){
  const month=`${Math.floor(i/12).toString().padStart(4,'0')}-${String(i%12+1).padStart(2,'0')}`,overviews=calculate(month);
  const issues=[...new Set(overviews.flatMap(r=>r.result.issues))];
  const complete=overviews.length===2&&!issues.length;
  if(complete)completeMonths++;
  if(overviews.length!==2)issues.push('Cần quyền xem cả Line A và B để phân bổ quỹ chung');
  const sourceA=complete?overviews.find(r=>r.line==='A').result.returned:null;
  const sourceB=complete?overviews.find(r=>r.line==='B').result.returned:null;
  const returned=complete?sourceA+sourceB:null;
  companyCumulative=companyCumulative===null||returned===null?null:companyCumulative+returned;
  companyRows.push({month,sourceA,sourceB,returned,cumulative:companyCumulative,complete});
  for(const overview of overviews){
   const {line,result,share}=overview;
   const r={month,line,complete,issues,allocated:share?.allocated??null,paid:complete?result.paid:null,unallocated:complete?result.unallocated:null,returned:complete?result.returned:null,retained:complete?result.unallocated:null,remaining:complete?result.unallocated+result.returned:null,cumulative:null};
   r.returnDetails=complete?[...(result.details||new Map())].filter(([,detail])=>detail.returned>0).map(([id,detail])=>{const person=overview.people?.find(p=>p.id===id);return {month,id,name:person?.name||id,homeLine:person?.line||'',workLine:line,hours:Number(person?.hc||0)+Number(person?.ot||0),amount:detail.returned,reason:detail.reason||''};}):[];
   if(!(line in running))running[line]=0;
   running[line]=running[line]===null||r.retained===null?null:running[line]+r.retained;r.cumulative=running[line];
   for(const key of Object.keys(totals))totals[key]=totals[key]===null||r[key]===null?null:totals[key]+r[key];
   rows.push(r);
  }
 }
 return {from,to,error:'',rows,companyRows,totals,completeMonths,monthCount:count};
}
