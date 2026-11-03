// Move only the selected cleaning group; never overwrite the destination day.
export function moveCleaningDate(days,sourceDate,index,targetDate){
 if(sourceDate===targetDate)return days;
 const source=days.find(d=>d.date===sourceDate),target=days.find(d=>d.date===targetDate);
 if(!target?.working)throw new Error('Chọn ngày có làm việc trong tuần đang xem.');
 const group=index===null?source?.cleaning:source?.cleaning?.[index];
 if(!group)throw new Error('Nhóm vệ sinh đã thay đổi. Kiểm tra lại trước khi sửa.');
 return days.map(day=>day.date===sourceDate?{...day,cleaning:index===null?[]:day.cleaning.filter((_,i)=>i!==index)}:day.date===targetDate?{...day,cleaning:[...(day.cleaning||[]),...(index===null?group.map(g=>({...g})):[{...group}])]}:day);
}
