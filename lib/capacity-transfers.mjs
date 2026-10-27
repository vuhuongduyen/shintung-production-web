export const clockMinute=s=>{if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s||''))throw Error('Giờ điều phối không hợp lệ (HH:mm).');return Number(s.slice(0,2))*60+Number(s.slice(3));};
export const mergeRanges=ranges=>{const out=[];for(const r of ranges.map(r=>[...r]).sort((a,b)=>a[0]-b[0])){if(r[1]<=r[0])continue;if(out.length&&r[0]<=out.at(-1)[1])out.at(-1)[1]=Math.max(out.at(-1)[1],r[1]);else out.push(r);}return out;};
export const subtractRanges=(ranges,cuts)=>cuts.reduce((out,[a,b])=>out.flatMap(([s,e])=>e<=a||s>=b?[[s,e]]:[[s,Math.min(e,a)],[Math.max(s,b),e]].filter(([x,y])=>y>x)),ranges);
export function rosterRanges(roster,day,shift,id){if(!roster?.[shift]?.includes(id))return [];const custom=roster[shift+'Windows']?.[id];if(custom!==undefined)return custom;return day?.[shift==='hc'?'working':'ot']?[[clockMinute(day[shift==='hc'?'hcStart':'otStart']),clockMinute(day[shift==='hc'?'hcEnd':'otEnd'])]]:[];}
export function validateRosterWindows(roster,day){for(const shift of ['hc','ot'])for(const [id,ranges] of Object.entries(roster?.[shift+'Windows']||{})){if(!roster[shift].includes(id)||!Array.isArray(ranges)||!ranges.length)throw Error('Khoảng điều phối không khớp danh sách nhân viên.');const a=clockMinute(day[shift==='hc'?'hcStart':'otStart']),b=clockMinute(day[shift==='hc'?'hcEnd':'otEnd']);for(const r of ranges)if(!Array.isArray(r)||r.length!==2||!r.every(Number.isInteger)||r[0]<a||r[1]>b||r[1]<=r[0])throw Error('Khoảng điều phối phải nằm trong ca làm việc.');if(mergeRanges(ranges).length!==ranges.length||mergeRanges(ranges).some((r,i)=>r[0]!==ranges[i][0]||r[1]!==ranges[i][1]))throw Error('Khoảng điều phối bị trùng hoặc sai thứ tự.');}}
export function validateCapacityAssignments(rows){const seen=new Map();for(const row of rows)for(const roster of row.input.dailyRoster||[]){const day=row.input.dailySchedule.find(d=>d.date===roster.date);validateRosterWindows(roster,day);for(const shift of ['hc','ot'])for(const id of roster[shift]){const key=roster.date+':'+id,rs=rosterRanges(roster,day,shift,id);for(const old of seen.get(key)||[])if(rs.some(([a,b])=>old.ranges.some(([c,d])=>a<d&&c<b)))throw Error(`${roster.date}: ${id} được phân công trùng thời gian ở cả Line ${old.line} và ${row.line}.`);seen.set(key,[...(seen.get(key)||[]),{line:row.line,ranges:rs}]);}}}
function setRanges(input,date,shift,id,ranges){const r=input.dailyRoster.find(r=>r.date===date);r[shift]=r[shift].filter(v=>v!==id);r[shift+'Windows']={...r[shift+'Windows']};if(ranges.length){r[shift].push(id);r[shift+'Windows'][id]=mergeRanges(ranges);}else delete r[shift+'Windows'][id];}
export function transferCapacityStaff(rows,employees,request){
 const {ids,from,to,date,toDate=date,shift,start,end}=request,a=clockMinute(start),b=clockMinute(end),next=structuredClone(rows),origin=next.find(r=>r.line===from),dest=next.find(r=>r.line===to);
 if(!dest||!dest.input.dailyRoster||from===to||!['hc','ot'].includes(shift)||!ids.length||new Set(ids).size!==ids.length||b<=a||toDate<date)throw Error('Chọn nhân viên, Line nguồn và khoảng thời gian hợp lệ.');
 if(dest.status!=='Nháp'||origin&&origin.status!=='Nháp')throw Error('Các Line liên quan phải ở trạng thái Nháp trước khi điều phối.');
 if(!dest.input.dailyRoster.some(r=>r.date===date)||!dest.input.dailyRoster.some(r=>r.date===toDate))throw Error('Ngày điều phối phải thuộc tuần đang chọn.');
 for(const id of ids)if(!employees.some(e=>e.id===id&&e.active!==false&&(origin||e.line===from)))throw Error(`${id}: nhân viên không thuộc Line nguồn.`);
 const days=dest.input.dailySchedule.filter(d=>d.date>=date&&d.date<=toDate&&d[shift==='hc'?'working':'ot']);if(!days.length)throw Error('Không có lịch làm việc trong khoảng điều phối.');
 const transfer={id:request.id||`MOVE-${Date.now()}-${Math.random().toString(36).slice(2)}`,employees:[...ids],from,to,date,toDate,shift,start,end,dates:days.map(d=>d.date)};
 for(const day of days){if(a<clockMinute(day[shift==='hc'?'hcStart':'otStart'])||b>clockMinute(day[shift==='hc'?'hcEnd':'otEnd']))throw Error(`${day.date}: thời gian điều phối nằm ngoài ca tại Line nhận.`);
  for(const id of ids){const dr=dest.input.dailyRoster.find(r=>r.date===day.date),existing=rosterRanges(dr,day,shift,id);if(existing.some(([s,e])=>s<b&&a<e))throw Error(`${id}: đã có lịch tại Line nhận trong khoảng giờ này.`);
   if(origin){const od=origin.input.dailySchedule.find(d=>d.date===day.date),or=origin.input.dailyRoster?.find(r=>r.date===day.date),available=rosterRanges(or,od,shift,id);if(subtractRanges([[a,b]],available).length)throw Error(`${id}: không có đủ thời gian tại Line nguồn ngày ${day.date}.`);
    const linked=[...(origin.input.dailyHcLeave||[]),...(origin.input.dailyOtLeave||[]),...(origin.input.otherTime||[]),...(od.cleaning||[])];if(linked.some(x=>(!x.date||x.date<=day.date&&(x.to||x.date)>=day.date)&&x.employees?.includes(id)))throw Error(`${id}: xử lý đăng ký nghỉ/vệ sinh/thời gian khác tại Line nguồn trước khi điều phối.`);
    setRanges(origin.input,day.date,shift,id,subtractRanges(available,[[a,b]]));
   }
   setRanges(dest.input,day.date,shift,id,[...existing,[a,b]]);
  }
 }
 for(const row of [origin,dest].filter(Boolean))row.input.staffTransfers=[...(row.input.staffTransfers||[]),transfer];
 validateCapacityAssignments(next);return {rows:next,lines:[...new Set([origin?.line,to].filter(Boolean))]};
}
export function removeCapacityTransfer(rows,id){const next=structuredClone(rows),move=next.flatMap(r=>r.input.staffTransfers||[]).find(t=>t.id===id);if(!move)throw Error('Không tìm thấy điều phối.');const origin=next.find(r=>r.line===move.from),dest=next.find(r=>r.line===move.to),a=clockMinute(move.start),b=clockMinute(move.end);if(!dest||[origin,dest].filter(Boolean).some(r=>r.status!=='Nháp'))throw Error('Các Line liên quan phải ở trạng thái Nháp trước khi xóa điều phối.');for(const date of move.dates)for(const employee of move.employees){const day=dest.input.dailySchedule.find(d=>d.date===date),r=dest.input.dailyRoster.find(r=>r.date===date),ranges=rosterRanges(r,day,move.shift,employee);if(subtractRanges([[a,b]],ranges).length)throw Error('Nhân viên đã được điều phối tiếp; hãy xử lý lượt sau trước.');setRanges(dest.input,date,move.shift,employee,subtractRanges(ranges,[[a,b]]));if(origin){const d=origin.input.dailySchedule.find(d=>d.date===date),r=origin.input.dailyRoster.find(r=>r.date===date);setRanges(origin.input,date,move.shift,employee,[...rosterRanges(r,d,move.shift,employee),[a,b]]);}}for(const row of next)row.input.staffTransfers=(row.input.staffTransfers||[]).filter(t=>t.id!==id);validateCapacityAssignments(next);return {rows:next,lines:[...new Set([origin?.line,dest.line].filter(Boolean))]};}
// Remove only minutes outside the person's assignment from the full-shift totals.
// Also undo deductions for those minutes so breaks/leave are never deducted twice.
export function capacityWindowAdjustment(roster,day,work,breaks,hcLeave,otLeave,cleaning,other,otWork){
 const result={hcGross:0,otGross:0,breaks:0,hcLeave:0,otLeave:0,clean:0,otherHc:0,otherOt:0};
 if(!roster)return result;validateRosterWindows(roster,day);
 const inside=(at,ranges)=>ranges.some(([a,b])=>a<=at&&at<b),inEntry=(at,x)=>at>=clockMinute(x.start)&&at<clockMinute(x.end);
 for(const shift of ['hc','ot'])for(const [id,ranges] of Object.entries(roster[shift+'Windows']||{})){
  const leaves=(shift==='hc'?hcLeave:otLeave).filter(x=>x.employees?.includes(id));
  if(shift==='ot'&&leaves.some(x=>x.mode==='attended'))throw Error(`${day.date}: nhân viên điều phối theo giờ cần nhập khoảng nghỉ TC cụ thể.`);
  for(let at=0;at<1440;at++){if(!inside(at,shift==='hc'?work:otWork)||inside(at,ranges))continue;
   result[shift==='hc'?'hcGross':'otGross']+=1/60;
   const full=leaves.some(x=>x.mode==='full'),partial=leaves.some(x=>x.mode==='hours'&&inEntry(at,x));
   if(shift==='hc'){
    const br=inside(at,breaks);if(!full&&br)result.breaks+=1/60;
    if(full||partial&&!br)result.hcLeave+=1/60;
    for(const c of cleaning)if(c.employees?.includes(id)&&inEntry(at,c))result.clean+=1/60;
   }else if(full||partial)result.otLeave+=1/60;
   for(const x of other)if(x.part===shift&&x.employees?.includes(id)&&inEntry(at,x))result[shift==='hc'?'otherHc':'otherOt']+=1/60;
  }
 }
 if(Object.keys(roster.hcWindows||{}).length)for(let at=0;at<1440;at++){
  const count=cleaning.filter(x=>inEntry(at,x)).reduce((s,x)=>s+Number(x.people),0);if(!count)continue;
  const present=roster.hc.filter(id=>inside(at,rosterRanges(roster,day,'hc',id))&&!hcLeave.some(x=>x.employees?.includes(id)&&(x.mode==='full'||x.mode==='hours'&&inEntry(at,x)))).length;
  if(count>present)throw Error(`${day.date}: số người vệ sinh vượt nhân viên có mặt sau điều phối.`);
 }
 return result;
}
