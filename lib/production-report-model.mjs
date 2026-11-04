export const dailyOutputModel='daily-finished-v1';
export const isDailyOutput=report=>report?.reportingModel===dailyOutputModel&&report.quantityOnly===true;

export const dailyAttendanceActions=new Set(['staff-recall','staff-recall-approve','warehouse-duty','attendance-edit','attendance-cancel','attendance-correction','line-absence','attendance-override','absence','line-movement','schedule']);
