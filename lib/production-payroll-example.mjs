import {normalized} from './production-plan.mjs';
import {usableSku} from './sku-state.mjs';
export const payrollWarehouseHelpers=['Quách Chanh Thảo','Trần Quốc Việt','Huỳnh Vạn Tiền'];
// Read-only illustration using current catalog names, employee names and menu standards.
// Never sent to production APIs or saved as confirmed business records.
/** @returns {{employees:Record<string,any>[],orders:Record<string,any>[],reports:Record<string,any>[],drafts:Record<string,{hc:string,ot:string,include:boolean}>,helpers:Record<string,{hours:Map<string,number>,issues:string[]}>}} */
export function monthlyPayrollExample(catalog,employees,standards,month){
 const orders=[],reports=[],drafts={},helpers={};
 const active=employees.filter(e=>e.active!==false&&!e._deleted&&!e.cancelled),helperIds=new Set(),helperIssues=[];
 for(const name of payrollWarehouseHelpers){const matches=active.filter(e=>normalized(e.name)===normalized(name));if(matches.length===1)helperIds.add(String(matches[0].id).toUpperCase());else helperIssues.push(`${matches.length?'Tên NV phụ kho bị trùng':'Chưa tìm thấy NV phụ kho'}: ${name}`);}

 for(const line of ['A','B']){
  const products=catalog.filter(p=>usableSku(p)&&String(p.line).replace(/^Line\s*/i,'').toUpperCase()===line&&Number(standards.get(String(p.code).toUpperCase()))>0).slice(0,2);
  const staff=employees.filter(e=>e.active!==false&&!e._deleted&&!e.cancelled&&e.line===line);
  if(!products.length||!staff.length)throw Error(`Line ${line}: cần sản phẩm có Giờ công chuẩn/SP và nhân viên đang hoạt động để tạo ví dụ.`);
  const support=new Map();let actual=0;
  const helperCount=staff.filter(p=>helperIds.has(String(p.id).toUpperCase())).length;
  // Keep the existing illustrative 20h/line only on the named helpers; never save these as actual hours.

  staff.forEach((p,i)=>{const id=String(p.id).toUpperCase(),hc=[176,168,160,152,144][i%5],ot=i%3===0?16:i%3===1?8:0;drafts[`${month}:${line}:${id}`]={hc:String(hc),ot:String(ot),include:true};actual+=hc+ot;support.set(id,helperIds.has(id)&&helperCount?20/helperCount:0);});
  helpers[line]={hours:support,issues:[...helperIssues]};
  const production=actual-[...support.values()].reduce((a,b)=>a+b,0),target=production*(line==='A'?.98:.88);
  products.forEach((p,i)=>{const id=`PAYROLL-MAU-${line}-${i+1}`,unit=standards.get(String(p.code).toUpperCase()),quantity=Math.max(1,Math.round(target*(products.length===1?1:i===0?.6:.4)/unit));
   orders.push({id,planId:`MAU-THANG-${line}-${i+1}`,lsxCode:`MAU-${month.replace('-','')}-${line}${i+1}`,sku:p.code,name:p.name,spec:p.specification,line,lsxQty:quantity,note:'Ví dụ hiệu suất tháng; không phải dữ liệu sản xuất thật'});
   reports.push({id:id+'-XT',transitId:id,kind:'completion',productionDate:month+'-05',reportedQuantity:quantity,approvedQuantity:quantity,reviewStatus:'Đã xác nhận',completedAt:month+'-05T17:00:00+07:00'});
  });
 }
 return {employees,orders,reports,drafts,helpers};
}
