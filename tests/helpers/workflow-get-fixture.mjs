import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../../scripts/local/database.mjs';
import {warehouseHelperNames,dutyDates} from '../../lib/warehouse-duty.mjs';
export const week='2026-11-02',day='2026-11-02';
export const at=(date,time)=>new Date(`${date}T${time}:00+07:00`).toISOString();
export const manager={login:'SYNTHETIC-QLSX',grants:['Quản lý sản xuất / Lịch SX thực tế / Xem','Quản lý sản xuất / Lịch SX thực tế / Sửa']};
export const hr={login:'SYNTHETIC-HR',grants:['Quản lý sản xuất / Lịch SX thực tế / Xem','Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
export async function workflowGetFixture(count=12){
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const conn=await openDatabase(mkdtempSync(resolve(base,'workflow-save-')));
 try{await migrate(conn.db);const db=conn.db,items=[];
  const add=(entity,id,payload)=>items.push(db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(payload),'SYNTHETIC','2026-11-02T04:00:00Z'));
  warehouseHelperNames.forEach((name,i)=>add('employees','SYNTHETIC-NV'+i,{name,line:'A',active:true}));
  add('employees','SYNTHETIC-B',{name:'Synthetic Line B',line:'B',active:true});
  const days=[...dutyDates(week),'2026-11-08'].map(date=>({date,working:date!=='2026-11-08',hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false}));
  add('capacity',week,{schemaVersion:1,week,rows:['A','B'].map(line=>({line,status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:3,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:line==='A'?['SYNTHETIC-NV0','SYNTHETIC-NV1','SYNTHETIC-NV2']:['SYNTHETIC-B'],ot:[]}))}}))});
  for(let i=0;i<count;i++){
   const date=i<2?day:'2026-10-05',id='SYNTHETIC-LSX'+i,start=at(date,'08:00'),end=at(date,'10:00');
   const order={id,planId:'SYNTHETIC-PLAN'+i,lsxCode:id,sku:'SYNTHETIC-SKU',line:'A',lsxQty:1000,syncStatus:'ĐÃ ĐỒNG BỘ',status:'MỞ',lsxOpenedAt:date,planStart:date,planEnd:date};add('in_transit',id,order);
   add('production_event',id+'-start',{id:id+'-start',kind:'start',sourceId:id,line:'A',employees:['SYNTHETIC-NV0'],count:1,effectiveAt:start,recordedAt:start});
   add('production_event',id+'-end',{id:id+'-end',kind:'complete',sourceId:id,line:'A',employees:['SYNTHETIC-NV0'],count:1,reportId:id+'-report',quantity:100,effectiveAt:end,recordedAt:end});
   add('production_report',id+'-report',{id:id+'-report',kind:'completion',transitId:id,line:'A',startedAt:start,completedAt:end,reportedQuantity:100,hours:{hc:2,ot:0,total:2,perEmployee:[{id:'SYNTHETIC-NV0',hc:2,ot:0,total:2}]},reviewStatus:i%2?'Đã xác nhận':'Chờ kiểm tra'});
  }
  for(let i=0;i<items.length;i+=80)await db.batch(items.slice(i,i+80));
  return conn;
 }catch(error){await conn.close();throw error;}
}
