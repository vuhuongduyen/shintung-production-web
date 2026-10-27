import {correctionStage} from './production-correction-orders.mjs';
export function correctionStaffing(event,reports){
 const stage=correctionStage(event),at=Date.parse(event.effectiveAt);
 const candidates=reports.filter(r=>!r.cancelled&&!r.voided&&r.transitId===event.sourceId&&correctionStage(r)===stage);
 const linked=candidates.filter(r=>r.id===event.reportId);
 const matches=linked.length?linked:candidates.filter(r=>Date.parse(r.startedAt)<=at&&at<=Date.parse(r.completedAt));
 const report=matches.length===1?matches[0]:null;
 if(event.erpStageImport)return {editable:!!report,key:report?.id,report,employees:report?.employees||[],count:report?.count??report?.sourceCount};
 const active=event.stageReporting&&['start','extra','resume','add'].includes(event.stageAction);
 const employees=event.stageReporting?(active?event.stageAfter?.people:event.stageBefore?.people)||[]:event.employees||[];
 return {editable:event.stageReporting?active:['start','add','reduce','transfer'].includes(event.kind),key:event.id,employees,count:event.stageReporting?employees.length:event.count};
}
export function validateCorrectionPeople(count,people,known){
 if(!Number.isSafeInteger(count)||count<1||count>10000)throw Error('Số nhân lực phải là số nguyên từ 1 đến 10.000.');
 if(!Array.isArray(people)||people.length!==count||new Set(people).size!==people.length)throw Error(`Số nhân lực là ${count}. Hãy tích chọn đúng ${count} nhân viên trước khi lưu.`);
 if(people.some(id=>typeof id!=='string'||!known.has(id)))throw Error('Nhân viên không có trong danh sách hợp lệ. Tải lại dữ liệu và chọn lại nhân viên.');
 return people;
}
