import {productionDisplayTime} from './production-display-time.mjs';
export function reportDate(value){
 const text=String(value??'').trim(),iso=text.match(/^(\d{4}-\d{2}-\d{2})(?:$|T|\s)/);
 if(iso){if(text.includes('T'))return productionDisplayTime(text,'').slice(0,10).split('/').reverse().join('-');return iso[1];}
 const local=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:$|\s|,)/);
 return local?`${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}`:'';
}
export function filterReportRows(rows,{from='',to='',dateColumn=-1,search=''}={}){
 if(from&&to&&from>to)throw Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
 if((from||to)&&dateColumn<0)throw Error('Hãy chọn cột ngày để tra cứu');
 const needle=search.trim().toLocaleLowerCase('vi');
 return rows.filter(row=>{const date=dateColumn<0?'':reportDate(row[dateColumn]);return (!(from||to)||(date&&(!from||date>=from)&&(!to||date<=to)))&&(!needle||row.some(v=>String(v??'').toLocaleLowerCase('vi').includes(needle)));});
}
export function tableExportReport({title,subtitle='',compactHeader=false,headers,rows,precisionColumns=[],from='',to='',dateColumn=-1,search='',at=new Date()}){
 const selected=filterReportRows(rows,{from,to,dateColumn,search}).map(r=>[...r]),cell=v=>({v,f:'text'}),row=(values,kind='data')=>({kind,values:values.map((v,i)=>({...cell(v),...(kind==='data'&&precisionColumns.includes(i)?{maximumFractionDigits:10}:{})}))});
 const timestamp=productionDisplayTime(at.toISOString()),note=(from||to)?`Từ ${productionDisplayTime(from,'…')} đến ${productionDisplayTime(to,'…')} (bao gồm hai ngày)`:'Theo dữ liệu và bộ lọc đang xem';
 return {title,subtitle,compactHeader,month:'',timestamp,note,sheets:[{name:title.slice(0,31),widths:headers.map(h=>/tên|nội dung|ghi chú|lý do/i.test(h)?32:22),rows:[row([title],'title'),...(subtitle?[row([subtitle])]:[]),...(compactHeader?[]:[row(['Thời điểm xuất',timestamp]),row(['Bộ lọc',note]),row(['Số dòng',selected.length])]),row(headers,'header'),...selected.map(v=>row(v))]}]};
}
export function laborUnitDeviation(unit,standard){
 if(unit===null||unit===undefined||standard===null||standard===undefined||!Number.isFinite(Number(unit))||!Number.isFinite(Number(standard))||Number(standard)<=0)return {ratio:null,warning:false};
 const ratio=(Number(unit)-Number(standard))/Number(standard);
 return {ratio,warning:Math.abs(ratio)>0.1+1e-12};
}
