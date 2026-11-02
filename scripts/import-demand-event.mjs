import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const [source,target]=process.argv.slice(2);
if(!source||!target) throw new Error("Usage: node import-demand-event.mjs input.pdf output.json");
const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(source))}).promise;
const rows=[];
const textAt=(items,min,max)=>items.filter((item)=>item.x>=min&&item.x<max).map((item)=>item.text).join(" ").trim();
const weekRange=(value)=>{
  const [day,month,year]=value.split("/").map(Number); if(!day||!month||!year)return "—";
  const date=new Date(Date.UTC(year,month-1,day)); const weekday=(date.getUTCDay()+6)%7;
  const monday=new Date(date);monday.setUTCDate(date.getUTCDate()-weekday);
  const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
  const format=(d)=>`${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  return `${format(monday)}–${format(sunday)}`;
};
for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
  const content=await(await pdf.getPage(pageNumber)).getTextContent();const visual=new Map();
  for(const item of content.items){if(!item.str?.trim()||!item.transform)continue;const y=Math.round(item.transform[5]);visual.set(y,[...(visual.get(y)||[]),{x:item.transform[4],text:item.str.trim()}]);}
  for(const [,raw] of [...visual.entries()].sort((a,b)=>b[0]-a[0])){
    const items=raw.sort((a,b)=>a.x-b.x); const requestDate=items[0]?.text||""; const sku=items[1]?.text||"";
    if(!/^\d{2}\/\d{2}\/\d{4}$/.test(requestDate)||!/^[A-Z0-9]{7,12}$/.test(sku))continue;
    const qtySpec=textAt(items,220,350);const match=qtySpec.match(/^([\d,.]+)\s*(.*)$/);if(!match)continue;
    const plannedDate=textAt(items,735,842); const statusRaw=textAt(items,665,735).toUpperCase();
    rows.push({id:`DE-PDF-${String(rows.length+1).padStart(4,"0")}`,requestDate,type:/BÙ TẢI/i.test(textAt(items,480,535))?"Bù tải":"Phát sinh",sku,name:textAt(items,135,220),spec:match[2]||"—",qty:Number(match[1].replace(/[.,]/g,"")),delivery:textAt(items,345,390)||"—",priority:/HIGH/i.test(textAt(items,450,480))?"Gấp":"Thường",order:"—",status:statusRaw.includes("ĐÃ LẬP")?"Đã lập kế hoạch":"Chưa lập kế hoạch",plannedWeek:plannedDate?weekRange(plannedDate):"—",updatedBy:textAt(items,530,610)||"—",updatedAt:textAt(items,610,665)||"—"});
  }
}
fs.writeFileSync(target,JSON.stringify(rows,null,2)+"\n");console.log({rows:rows.length,planned:rows.filter(row=>row.status==="Đã lập kế hoạch").length,unplanned:rows.filter(row=>row.status==="Chưa lập kế hoạch").length});
