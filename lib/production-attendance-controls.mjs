// Explicit attendance-only UI profile requested for this authenticated login.
// This narrows presentation only; server permissions and all other grants are unchanged.
export function attendanceUiRights(login,rights={}) {
 const attendanceOnly=String(login||'').trim().toLowerCase()==='haquyen';
 return {...rights,manager:Boolean(rights.manager)&&!attendanceOnly};
}
export function attendanceInputTypes({hr=false,manager=false}={}) {
 return [...(hr?['Nghỉ','Đi trễ','Về sớm']:[]),...(manager?['Phụ kho','CV khác','Chuyển Line','Thu hồi nhân sự']:[])];
}
export function attendanceInputType(value,rights) {
 const types=attendanceInputTypes(rights);
 return types.includes(value)?value:types[0]||'';
}
export function canEditAttendance(entry,{hr=false,manager=false}={}) {
 if(!entry||entry.cancelled||entry.hrScopeProjection)return false;
 if(entry.kind==='line-movement')return manager&&entry.movementType!=='recall';
 if(!['absence','line-absence','attendance-override'].includes(entry.kind))return false;
 return ['Phụ kho','CV khác'].includes(entry.absenceType)?manager:hr;
}
