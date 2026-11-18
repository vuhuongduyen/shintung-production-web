export const laborHourNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export const formatLaborHour=value=>laborHourNumber(value)===null?'Chưa có định mức':value.toFixed(3)+' giờ/SP';
