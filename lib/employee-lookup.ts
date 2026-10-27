import type {LookupOption} from '../components/standard-toolbar/LookupInput';
import {lookupText} from './lookup-text';
type Employee={id?:string;name?:string;sourceEmployeeId?:string;line?:string};
export function employeeLookupOptions(employees:Employee[],line?:string):LookupOption[]{
 return employees.filter(person=>!!person.id&&(!line||person.line===line)).map(person=>({value:person.sourceEmployeeId||person.id||'',label:`${person.sourceEmployeeId||person.id} · ${person.name||''}`,searchText:`${person.id} ${person.sourceEmployeeId||''} ${person.name||''}`}));
}
/** Compile once per render; event snapshots may omit the directory's display code. */
export function employeeLookupMatcher(query:string,employees:Employee[]):(person:Employee)=>boolean{
 const text=lookupText(query);if(!text)return()=>true;
 const directory=new Map(employees.map(person=>[lookupText(person.id||''),person]));
 const exactIds=new Set(employees.filter(person=>lookupText(person.id||'')===text||!!person.sourceEmployeeId&&lookupText(person.sourceEmployeeId)===text).map(person=>lookupText(person.id||'')));
 return person=>{const id=lookupText(person.id||'');if(exactIds.size)return exactIds.has(id);const record=directory.get(id);return lookupText(`${person.id||''} ${record?.sourceEmployeeId||person.sourceEmployeeId||''} ${person.name||record?.name||''}`).includes(text);};
}
