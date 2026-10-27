import {dateISO,monday,displayDate} from './production-plan.mjs';
import {productionDisplayTime} from './production-display-time.mjs';
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'});
// Calendar dates are not instants. Preserve them; derive dates from instants in Vietnam.
/** @param {string | Date | number | null} [value] */
export function vietnamDate(value=new Date()){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return dateISO(value);
 if(!value)return '';
 const instant=value instanceof Date?value:new Date(value);if(!Number.isFinite(instant.getTime()))return '';
 const parts=Object.fromEntries(calendar.formatToParts(instant).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export const vietnamMonday=value=>monday(vietnamDate(value));
export const vietnamDisplayDate=value=>displayDate(vietnamDate(value));
// Old inventory rows contain localized strings with no offset. Never guess their timezone.
export function inventoryDisplayTime(value){
 if(!value)return '—';
 return /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(value))?productionDisplayTime(value):String(value);
}
