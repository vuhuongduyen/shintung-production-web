export const dailyOutputModel='daily-finished-v1';
export const isDailyOutput=report=>report?.reportingModel===dailyOutputModel&&report.quantityOnly===true;
