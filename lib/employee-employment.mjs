// Date-only employment boundaries in the site's Vietnam timezone. End date is the first day no longer working.
export const employmentToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
export function employeeActiveOn(person,date=employmentToday()){
 if(!person||person.cancelled||person._deleted)return false;
 if(!person.employmentDatesManaged&&!person.startDate&&!person.endDate)return person.active!==false;
 return (!person.startDate||date>=person.startDate)&&(!person.endDate||date<person.endDate);
}
export const validEmploymentDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
