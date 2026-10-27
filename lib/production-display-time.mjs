const dateTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function productionDisplayTime(value,empty='—') {
 if(!value)return empty;
 if(/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return String(value).split('-').reverse().join('/');
 const instant=new Date(value);if(!Number.isFinite(instant.getTime()))return empty;
 const parts=Object.fromEntries(dateTime.formatToParts(instant).map(p=>[p.type,p.value]));
 return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
