import {efficiencyBands} from './production-payroll.mjs';
import {payrollColumnFormulas} from './production-payroll-columns.mjs';
export const traceLabels={score:'Hiệu suất (%)',factor:'Hệ số quỹ',ratio:'Tỷ trọng phân bổ (%)',allocated:'Quỹ phân bổ trước hệ số',fund:'Quỹ sản lượng được hưởng',earned:'Giờ công chuẩn HT',actual:'Giờ hiện diện',support:'Giờ phụ kho',otherWork:'Giờ CV khác',production:'Giờ SX',paid:'Tiền thực trả',unallocated:'Quỹ chưa phân bổ',returned:'Quỹ hoàn lại',redistributed:'Tiền chia lại trong line',baseFund:'Quỹ chung A + B (đồng)'};
export function traceValue(row,key){
 if(key==='ratio')return row.share?row.share.ratio*100:null;
 if(key==='allocated')return row.share?.allocated??null;
 if(key==='otherWork')return row.selected.reduce((n,p)=>n+Number(p.otherWork||0),0);
 return ['score','factor','fund','paid','unallocated','returned','redistributed'].includes(key)?row.result[key]:row[key];
}
export function payrollTrace(overviews,line,key,baseFund){
 const row=overviews.find(r=>r.line===line);if(!row)return null;
 const source=(k,l=line)=>({key:k,line:l,label:traceLabels[k],value:k==='baseFund'?Number(baseFund):traceValue(overviews.find(r=>r.line===l)||{},k)});
 const sources={score:()=>[source('earned'),source('production')],factor:()=>[source('score')],ratio:()=>overviews.map(r=>source('earned',r.line)),allocated:()=>[source('baseFund'),source('ratio')],fund:()=>[source('allocated'),source('factor')],production:()=>[source('actual'),source('support'),source('otherWork')],unallocated:()=>[source('allocated'),source('fund')],paid:()=>[source('fund'),source('returned')]};
 const fmt=(v,digits=2)=>v===null||v===undefined?'—':Number(v).toLocaleString('vi-VN',{maximumFractionDigits:digits});
 const v=k=>fmt(traceValue(row,k)),total=overviews.every(r=>r.earned!==null)?overviews.reduce((n,r)=>n+r.earned,0):null;
 const equations={score:()=>`${v('earned')} ÷ ${v('production')} × 100 ≈ ${v('score')}%`,factor:()=>{const at=efficiencyBands.findIndex(b=>row.result.score>=b.min);const band=efficiencyBands[at];return `${v('score')}% · ${band?.min}%${at>0?' ≤ Hiệu suất (%) < '+efficiencyBands[at-1].min+'%':' ≤ Hiệu suất (%)'} → Hệ số quỹ = ${v('factor')}`;},ratio:()=>`${v('earned')} ÷ (${overviews.map(r=>fmt(r.earned)).join(' + ')}) × 100 ≈ ${v('ratio')}%`,allocated:()=>`${fmt(baseFund)} × ${v('ratio')} ÷ 100 → ${v('allocated')}`,fund:()=>`${v('allocated')} × ${v('factor')} → ${v('fund')}`,production:()=>`${v('actual')} − ${v('support')} − ${v('otherWork')} ≈ ${v('production')}`,unallocated:()=>`${v('allocated')} − ${v('fund')} = ${v('unallocated')}`,paid:()=>`${v('fund')} − ${v('returned')} = ${v('paid')}`};
 const value=traceValue(row,key),blocked=value===null||value===undefined||(key==='ratio'&&!(total>0));
 let contributors=[];
 if(key==='earned')contributors=row.rows.map(r=>({name:`${r.order.lsxCode} · ${r.order.sku}`,formula:`SL đã xác nhận (${fmt(r.qty)}) × Giờ công chuẩn/SP (${fmt(r.unit,4)})`,value:r.earned}));
 if(['actual','support','otherWork','returned','redistributed','paid'].includes(key))contributors=row.selected.map(p=>{
  const detail=row.result.details.get(p.id),actual=Number(p.hc)+Number(p.ot);
  const value={actual,support:p.helper,otherWork:p.otherWork||0,returned:detail?.returned,redistributed:detail?.redistributed,paid:row.result.payments.get(p.id)}[key];
  const formula=key==='actual'?`Giờ lịch HC (${fmt(p.calendarHc)}) + Giờ lịch TC (${fmt(p.calendarOt)}) − Vắng HC (${fmt(p.absentHc)}) − Vắng TC (${fmt(p.absentOt)})`:key==='paid'?`Phần theo đóng góp (${fmt(detail?.base)}) + Tiền chia thêm (${fmt(detail?.additional)}) · ${detail?.reason||'Chưa đủ dữ liệu'}`:key==='returned'||key==='redistributed'?`Phần theo đóng góp · ${detail?.reason||'Chưa đủ dữ liệu'}`:traceLabels[key];
  return {name:`${p.name} (${p.id})`,formula,value};
 });
 if(['support','otherWork'].includes(key))contributors=contributors.filter(c=>Number(c.value)>0);
 return {line,key,label:traceLabels[key],value,blocked,sources:sources[key]?.()||[],formula:key==='paid'?'Tiền thực trả = Quỹ sản lượng được hưởng − Quỹ hoàn lại':`${traceLabels[key]} = ${payrollColumnFormulas[traceLabels[key]]||'Tổng theo nhân viên tham gia'}`,equation:blocked?'':equations[key]?.()||`Σ (${contributors.length}) = ${fmt(value)}`,contributors,issues:blocked?row.result.issues:[],rounding:['allocated','fund','returned','redistributed','paid'].includes(key)};
}
