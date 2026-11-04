import {openDatabase,migrate} from '../../scripts/local/database.mjs';
import {recordRevision} from '../../lib/record-revision.mjs';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {quickLinePermissions} from '../../lib/user-permission-profiles.mjs';
export const actor={login:'LINE_A',line:'A',authMode:'quick_line',grants:quickLinePermissions};
export async function dailyFixture(run){
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'daily-output-')));try{
  await migrate(c.db);const put=(entity,key,value)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'SYNTHETIC','2026-11-01').run();
  const order={id:'SYNTHETIC-LSX',planId:'SAME-PLAN',planGroupId:'SPLIT-GROUP',lsxCode:'SYNTHETIC-LSX',sku:'SYNTHETIC-SKU',name:'Synthetic product',line:'A',lsxQty:1000,lsxOpenedAt:'2026-11-01',planEnd:'2026-12-01',syncStatus:'ĐÃ ĐỒNG BỘ'};
  await put('in_transit',order.id,order);await put('in_transit','OTHER-LSX',{...order,id:'OTHER-LSX',lsxCode:'OTHER-LSX'});
  await put('production_reporting_policy','global',{mode:'daily-finished-v1',approved:true,effectiveFrom:'2026-11-01',revision:1});
  await put('production_cursor','global',{version:0,token:''});
  await put('labor_hours',order.sku,{sku:order.sku,laborHour:.9,version:2,effectiveVersions:[{id:'SYNTHETIC-OLD-RATE',status:'published',value:.1,validFrom:'2026-11-01',validTo:'2026-11-03'},{id:'SYNTHETIC-NEW-RATE',status:'published',value:.2,validFrom:'2026-11-03'}]});
  const body=(extra={})=>({action:'daily-output',orderId:order.id,quantity:200,productionDate:'2026-11-02',productionLocalDateTime:`${extra.productionDate||'2026-11-02'}T09:00`,expectedOrderRevision:null,requestIdempotency:crypto.randomUUID(),...extra});
  const revision=await recordRevision(JSON.stringify(order));
  await run({...c,put,order,body:extra=>({...body(extra),expectedOrderRevision:extra?.expectedOrderRevision??revision})});
 }finally{await c.close();}
}
