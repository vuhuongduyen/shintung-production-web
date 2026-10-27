import {dateISO,monday,text,numberOrNull} from './production-plan.mjs';
export const transitImportColumns=['Plan ID','SKU','Line','Ngày bắt đầu KH','Ngày dự kiến hoàn thành','Mã LSX','SL kế hoạch','SL LSX','Ngày mở LSX','SL hoàn thành','Ngày bắt đầu thực tế','Ngày hoàn thành thực tế'];
export function parseTransitHistory(value,week) {
 if(!dateISO(week)||monday(week)!==week)throw Error('Chọn tuần bắt đầu vào thứ Hai.');
 const lines=String(value||'').split(/\r?\n/).filter(l=>l.trim());
 if(!lines.length||lines.length>100)throw Error('Nhập từ 1 đến 100 dòng.');
 const seen=new Set();
 return lines.map((line,index)=>{
 const c=line.split('\t').map(v=>v.trim());
 const extended=c.length===17;
 if(c.length!==12&&!extended)throw Error(`Dòng ${index+1}: cần đủ 12 hoặc 17 cột, ngăn bằng Tab.`);
 const [planId,sku,lineName,start,end,lsxCode,plan,lsx,opened,completed,actualStart,actualEnd]=c;
 const extra=extended?{source:c[12],priority:c[13],sequence:numberOrNull(c[14]),name:c[15],spec:c[16],extendedImport:true}:{};
 const r={...extra,planId,sku:sku.toUpperCase(),line:lineName.toUpperCase(),week,planStart:dateISO(start),planEnd:dateISO(end),lsxCode,planQty:numberOrNull(plan),lsxQty:numberOrNull(lsx),lsxOpenedAt:dateISO(opened),completedQty:numberOrNull(completed),actualStartedAt:dateISO(actualStart),actualCompletedAt:dateISO(actualEnd)};
 if(!planId||!sku||!['A','B'].includes(r.line)||(!extended&&!lsxCode)||seen.has('plan:'+planId)||(lsxCode&&seen.has(lsxCode)))throw Error(`Dòng ${index+1}: thiếu mã, sai Line hoặc trùng LSX.`);
 seen.add('plan:'+planId);if(lsxCode)seen.add(lsxCode);
 if(extended&&!lsxCode&&r.completedQty===null)r.completedQty=0;
 if(!(r.planQty>0)||(lsxCode?!(r.lsxQty>0):r.lsxQty!==null)||r.completedQty===null||r.completedQty<0||r.completedQty>(r.lsxQty||0))throw Error(`Dòng ${index+1}: số lượng không hợp lệ.`);
 if((!extended&&(!r.planStart||!r.planEnd))||(start&&!r.planStart)||(end&&!r.planEnd)||(r.planStart&&r.planEnd&&r.planEnd<r.planStart)||(lsxCode&&!r.lsxOpenedAt)||(!lsxCode&&(opened||actualStart||actualEnd))||(actualStart&&!r.actualStartedAt)||(actualEnd&&!r.actualCompletedAt))throw Error(`Dòng ${index+1}: ngày không hợp lệ.`);
 if((r.completedQty>0&&!r.actualStartedAt)||(r.actualCompletedAt&&(!r.actualStartedAt||r.actualCompletedAt<r.actualStartedAt||r.completedQty!==r.lsxQty))||(r.lsxQty>0&&r.completedQty===r.lsxQty&&!r.actualCompletedAt))throw Error(`Dòng ${index+1}: số lượng hoàn thành và ngày thực tế chưa khớp.`);
 return r;
 });
}
