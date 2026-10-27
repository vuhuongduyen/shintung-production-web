import {nonNegative} from './production-payroll.mjs';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase().replace(/\s+/g,' ').trim();
const contains=(text,value)=>` ${text} `.includes(` ${value} `);
// Identity only: hours are selected explicitly and reviewed before applying.
export function matchHrRows(lines,employees){
 const master=employees.filter(e=>!e._deleted&&e.active!==false).map(e=>({...e,id:String(e.id).trim().toUpperCase(),normalizedName:normalize(e.name)}));
 const rows=[],unmatched=[];
 for(const line of lines){
  const text=normalize(line.text),tokens=text.replace(/[|;,:]/g,' ').split(/\s+/),ids=master.filter(e=>tokens.includes(e.id)),names=master.filter(e=>e.normalizedName&&contains(text,e.normalizedName));
  if(!ids.length&&!names.length){unmatched.push(line);continue;}
  const employee=ids.length===1?ids[0]:!ids.length&&names.length===1?names[0]:null;
  let issue=employee?'':'Không xác định duy nhất nhân viên';
  if(!ids.length&&employee&&tokens.some(token=>token!==employee.id&&token.startsWith(employee.id)))issue='Mã NV có nhưng tên không khớp';
  if(employee&&!['A','B'].includes(employee.line))issue='NV chưa có Line A/B';
  if(employee&&!contains(text,employee.normalizedName))issue='Mã NV có nhưng tên không khớp';
  if(employee&&names.some(e=>e.id!==employee.id))issue='Mã và tên thuộc hai nhân viên khác nhau';
  const nameEnd=employee?text.indexOf(employee.normalizedName)+employee.normalizedName.length:0;
  const after=employee&&nameEnd>0?text.slice(nameEnd).replaceAll(employee.id,''):'';
  const numbers=after.split(/\s+/).map(v=>v.replace(/[|;]/g,'')).filter(v=>/^\d+(?:[.,]\d+)?$/.test(v));
  rows.push({...line,id:employee?.id||'',name:employee?.name||'',line:employee?.line||'',numbers,hc:'',ot:'',issue,matchedBy:ids.length?'id':'name'});
 }
 const counts=new Map();for(const row of rows)if(row.id)counts.set(row.id,(counts.get(row.id)||0)+1);
 for(const row of rows)if(counts.get(row.id)>1)row.issue='NV xuất hiện nhiều dòng; cần bảng tổng giờ tháng';
 return {rows,unmatched};
}
export function validHrRows(rows){return rows.length>0&&rows.every(r=>r.id&&['A','B'].includes(r.line)&&!r.issue&&nonNegative(r.hc)!==null&&nonNegative(r.ot)!==null&&nonNegative(r.hc)+nonNegative(r.ot)<=744);}

export function hrFileMonth(name){const match=String(name||'').match(/(?:^|[^0-9])(20[0-9]{2})[-_. ](0[1-9]|1[0-2])(?:[^0-9]|$)/);return match?`${match[1]}-${match[2]}`:null;}
