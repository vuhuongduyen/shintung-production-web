// Synthetic, isolated local Miniflare only. Never reads a deployed Site/DB.
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {root,openDatabase,migrate} from '../local/database.mjs';
import {getPlan,mutatePlan} from '../local/production-plan.mjs';
const week='2026-11-02',actor={login:'SYNTHETIC-bench',grants:['Kế hoạch sản xuất / Production_plan / Sửa']};
const legacy=process.argv.includes('--legacy-refresh');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.floor(sorted.length/2)]*100)/100;};
for(const count of [100,500]){
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});
 const connection=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/split-benchmark-')));
 try{
  await migrate(connection.db);
  let preparations=0;const db={prepare(sql){preparations++;return connection.db.prepare(sql);},batch(statements){return connection.db.batch(statements);}};
  const rows=Array.from({length:count},(_,i)=>({id:`SYNTHETIC-${i}`,sku:`SYNTHETIC-${i}`,name:'Synthetic benchmark',week,line:'A',plan:10,suggested:10,laborHour:0.01,start:week,end:week,priority:'THƯỜNG',type:'TUẦN CHÍNH',status:'DỰ KIẾN'}));
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan',week,JSON.stringify({schemaVersion:2,week,revision:0,rows}),actor.login,'fixture').run();
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity',week,JSON.stringify({schemaVersion:1,week,rows:[{week,line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,availableHours:100000}]}),actor.login,'fixture').run();
  let state=await getPlan(db,week);const metrics={split:[],splitRefresh:[],splitVisible:[],save:[],reload:[],transfer:[],responseBytes:[],splitPreparations:[]};
  const run=async(action,ids,extra={})=>{const result=await mutatePlan(db,{action,ids,week,revision:state.revision,...extra},actor);state.revision=result.revision;return result;};
  for(let i=0;i<3;i++){
   const before=new Set(state.rows.map(r=>r.id)),queries=preparations,start=performance.now();
   const result=await run('split',['SYNTHETIC-0']);metrics.split.push(performance.now()-start);metrics.responseBytes.push(Buffer.byteLength(JSON.stringify(result)));
   const refreshStart=performance.now();
   if(legacy)state=await getPlan(db,week);else{if(!Array.isArray(result.rows))throw Error('Optimized split response has no rows');const updates=new Map(result.rows.map(r=>[r.id,r]));state.rows=[...state.rows.map(r=>updates.get(r.id)||r),...result.rows.filter(r=>!before.has(r.id))];}
   metrics.splitRefresh.push(performance.now()-refreshStart);metrics.splitVisible.push(performance.now()-start);metrics.splitPreparations.push(preparations-queries);
   const child=state.rows.find(r=>!before.has(r.id));if(!child)throw Error('Missing created row');
   let at=performance.now();await run('save',[child.id],{edits:{[child.id]:{plan:5}}});metrics.save.push(performance.now()-at);
   await run('close',[child.id]);at=performance.now();await run('transfer',[child.id]);metrics.transfer.push(performance.now()-at);
   at=performance.now();state=await getPlan(db,week);metrics.reload.push(performance.now()-at);
  }
  console.log(JSON.stringify({mode:legacy?'POST+full GET':'POST+changed rows',node:process.version,rows:count,repetitions:3,scope:'direct handlers + JSON size, local Miniflare; no browser/network latency; confirmed scalar Capacity fixture',median:Object.fromEntries(Object.entries(metrics).map(([key,values])=>[key,median(values)])),samples:metrics}));
 }finally{await connection.close();}
}
