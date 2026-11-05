// Explicit synthetic QA only. Never imported by Worker/Vite runtime.
import {Miniflare} from 'miniflare';
import {resolve} from 'node:path';
import {readdirSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {configuration,migrate,root} from '../local/database.mjs';
import {passwordRecord} from '../../worker/password-auth.mjs';
import {activateDailyPolicy} from '../../tests/helpers/activate-daily-policy.mjs';
import {mutateProductionWorkflow} from '../local/production-workflow.mjs';
import {reviewDailyOutput} from '../local/production-daily-review.mjs';
import {permissionProfiles} from '../../lib/user-permission-profiles.mjs';
import {newDailyCapacity,calculateCapacity} from '../../lib/capacity.mjs';
import {warehouseHelperNames} from '../../lib/warehouse-duty.mjs';
import {recordRevision} from '../../lib/record-revision.mjs';
// Each QA process creates a disposable local-only test passphrase, never a real credential.
export async function dailyOutputLoopback({port=0}={}){
 configuration();
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid loopback port');
 const base=resolve(root,'dist/server'),entry=resolve(base,'index.js');
 if(!existsSync(entry))throw Error('Build exact source first with npm run build');
 const paths=readdirSync(base,{recursive:true}).filter(n=>n.endsWith('.js')).map(n=>resolve(base,n));
 let outboundBlocked=0;
 const runtime=new Miniflare({modules:[entry,...paths.filter(p=>p!==entry)].map(path=>({type:'ESModule',path})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port,cf:false,d1Databases:{DB:'synthetic-daily-qa'},d1Persist:false,r2Buckets:{FILES:'synthetic-daily-qa-files'},r2Persist:false,assets:{directory:resolve(root,'dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}},outboundService:()=>{outboundBlocked++;return new Response('Synthetic QA blocks outbound requests',{status:503});}});
 try{
  const db=await runtime.getD1Database('DB');await migrate(db);
  const now=new Date().toISOString(),put=(entity,key,value)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'SYNTHETIC-QA',now).run();
  for(const department of ['HR','QLSX','KHO','KHSX'])await put('department_permissions',department,{department,active:true,permissions:permissionProfiles[department].grants.join(' · ')});
  const fixturePassphrase=crypto.randomUUID();
  const accounts=[['QA_ADMIN','SUPER_ADMIN',''],['QA_HR','USER','HR'],['QA_QLSX','USER','QLSX'],['QA_KHO','USER','KHO'],['QA_KHSX','USER','KHSX']];
  for(const [login,role,department] of accounts){await put('users',login,{login,name:'Synthetic '+login,role,department,active:true});const p=await passwordRecord(fixturePassphrase);await db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,now).run();}
  await put('users','LINE_A',{login:'LINE_A',name:'Synthetic Line A',line:'A',role:'USER',authMode:'quick_line',active:true});await db.prepare("INSERT INTO auth_accounts VALUES('LINE_A','QUICK_LINE','',100000,1,?)").bind(now).run();
  const days=Array.from({length:30},(_,i)=>({date:'2026-11-'+String(i+1).padStart(2,'0'),working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false}));
  for(const line of ['A','B']){const id='SYNTHETIC-NV-'+line;await put('employees',id,{id,name:line==='A'?warehouseHelperNames[0]:'Synthetic employee '+line,line,startDate:'2026-01-01',active:true});}
  for(const week of ['2026-10-26','2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30']){const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(week+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);return {...days[0],date:d.toISOString().slice(0,10),working:d.getUTCDay()!==0};});await put('capacity',week,{schemaVersion:1,week,rows:['A','B'].map(line=>{const input={...newDailyCapacity(week,line,100).input,workers:1,dailySchedule:weekDays,dailyRoster:weekDays.map(d=>({date:d.date,hc:['SYNTHETIC-NV-'+line],ot:[]}))};return {line,week,status:'Đã xác nhận',reviewStatus:'approved',version:1,syncedAt:'2026-11-01T00:00:00Z',khsxAcceptedAt:'2026-11-01T00:00:00Z',availableHours:calculateCapacity(input,week).availableHours,input};})});}
  const order={id:'SYNTHETIC-DAILY-A',planId:'SYNTHETIC-SHARED-PLAN',planGroupId:'SYNTHETIC-SPLIT',lsxCode:'SYNTHETIC-DAILY-A',sku:'SYNTHETIC-SKU',name:'Synthetic daily output product',spec:'TEST only',unit:'Cái',line:'A',lsxQty:1000,lsxOpenedAt:'2026-11-01',planStart:'2026-11-01',planEnd:'2099-12-31',syncStatus:'ĐÃ ĐỒNG BỘ',status:'MỞ'};
  await put('sku',order.sku,{code:order.sku,name:order.name,line:'A',unit:'Cái',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
  await put('in_transit',order.id,order);await put('in_transit','SYNTHETIC-SIBLING',{...order,id:'SYNTHETIC-SIBLING',lsxCode:'SYNTHETIC-SIBLING'});await put('in_transit','SYNTHETIC-B',{...order,id:'SYNTHETIC-B',lsxCode:'SYNTHETIC-B',line:'B'});
  await put('labor_hours',order.sku,{sku:order.sku,laborHour:.2,version:2,effectiveVersions:[{id:'SYNTHETIC-RATE-1',status:'published',value:.1,validFrom:'2026-11-01',validTo:'2026-11-03'},{id:'SYNTHETIC-RATE-2',status:'published',value:.2,validFrom:'2026-11-03'}]});await put('production_cursor','global',{version:0,token:''});
  await put('leadtime',order.sku,{sku:order.sku,leadTime:2});
  await put('leadtime_versions','SYNTHETIC-LEADTIME-1',{id:'SYNTHETIC-LEADTIME-1',sku:order.sku,leadTime:2,status:'Đang áp dụng',validFrom:'2026-11-01',confirmedAt:'2026-11-01T00:00:00Z'});
  await put('production_engine','SYNTHETIC-QA-ENGINE',{week:'2026-11-02',generatedAt:'2026-11-02T00:00:00Z',rows:[{id:'SYNTHETIC-QA-ENGINE-ROW',sku:order.sku,name:order.name,line:'A',suggested:100,priority:'THƯỜNG'}]});
  await put('production_plan','2026-11-02',{schemaVersion:2,week:'2026-11-02',revision:0,rows:[{id:'SYNTHETIC-QA-PLAN',sku:order.sku,name:order.name,week:'2026-11-02',line:'A',plan:100,suggested:100,start:'2026-11-02',end:'2026-11-06',status:'DỰ KIẾN',laborHour:.2,sourceIds:['SYNTHETIC-QA-ENGINE-ROW'],source:'05_PRODUCTION_ENGINE'}]});
  const legacy={...order,id:'SYNTHETIC-LEGACY-LSX',lsxCode:'SYNTHETIC-LEGACY-LSX'};await put('in_transit',legacy.id,legacy);await put('production_report','SYNTHETIC-LEGACY-REPORT',{id:'SYNTHETIC-LEGACY-REPORT',kind:'completion',transitId:legacy.id,line:'A',stageCode:'FINAL',productionDate:'2026-10-30',startedAt:'2026-10-30T01:00:00Z',completedAt:'2026-10-30T03:00:00Z',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',hours:{hc:2,ot:0,total:2},standardUnit:.2});
  await activateDailyPolicy(db,{effectiveFrom:'2026-11-01'});
  const actor={login:'QA_ADMIN',isAdmin:true};let first;
  for(const [quantity,date] of [[200,'2026-11-02'],[300,'2026-11-03']]){const row=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(order.id).first(),saved=await mutateProductionWorkflow(db,{action:'daily-output',orderId:order.id,quantity,productionDate:date,productionLocalDateTime:date+'T09:00',expectedOrderRevision:await recordRevision(row.payload),requestIdempotency:crypto.randomUUID()},actor);if(!first){first=saved.report;await reviewDailyOutput(db,{action:'review',reportId:first.id,approve:true,expectedVersion:1},actor);}}
  const url=String(await runtime.ready);
  return {runtime,db,url,accounts:accounts.map(a=>a[0]),password:fixturePassphrase,outboundBlocked:()=>outboundBlocked,close:()=>runtime.dispose()};
 }catch(error){await runtime.dispose();throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv[2]!=='--synthetic-loopback')throw Error('Explicit --synthetic-loopback required; no real database is supported');
 const qa=await dailyOutputLoopback({port:Number(process.argv[3]||5180)});
 console.log(JSON.stringify({url:qa.url,synthetic:true,volatileDatabase:true,files:'volatile local R2',externalRequests:'blocked',accounts:qa.accounts,password:qa.password,limits:'Full built ONSPA + Worker. Synthetic accounts use ordinary password authentication, no injected Admin or rewritten cookies. Source JSON compatibility baselines remain in the unchanged build. No actual Google Sheet/production/auth acceptance.'}));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await qa.close();process.exit(0);});
}
