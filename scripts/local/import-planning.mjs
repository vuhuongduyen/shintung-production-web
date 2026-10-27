import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,records,root,sha256} from './database.mjs';

export const nextMonth = value => {
  if(!/^(0[1-9]|1[0-2])\/\d{4}$/.test(value)) throw Error('Invalid source month');
  const [m,y]=value.split('/').map(Number); return `${String(m%12+1).padStart(2,'0')}/${y+(m===12?1:0)}`;
};
export const demandKey = row => JSON.stringify([row.requestDate,row.sku,Number(row.qty),row.delivery,row.type,row.plannedWeek]);
export function validatePlanning(input){
  if(input.format!=='ONSPA-PDF-PLANNING-v1'||input.forecasts.length!==2||input.demand.length!==104)throw Error('Invalid input/counts');
  input.forecasts.forEach((rows,i)=>{
    if(rows.length!==[302,304][i]||new Set(rows.map(r=>r.sku)).size!==rows.length)throw Error('Forecast count/duplicate');
    for(const row of rows)if(row.sourceReportMonth!==['07/2026','08/2026'][i]||row.applicationMonth!==nextMonth(row.sourceReportMonth)||row.month!==row.applicationMonth||!['adjustment30D','f30','f60','f90'].every(k=>Number.isSafeInteger(row[k])))throw Error('Invalid forecast');
  });
  if(new Set(input.demand.map(demandKey)).size!==104||input.demand.some(r=>r.status.toUpperCase()!=='ĐÃ LẬP KẾ HOẠCH'||!Number.isSafeInteger(r.qty)))throw Error('Demand duplicate/status');
}
export async function importPlanning(db,input){
  validatePlanning(input);
  const before=await records(db), now=new Date().toISOString(), stamp=now.replaceAll(':','-');
  const dir=resolve(root,'backups/test');mkdirSync(dir,{recursive:true});
  const backup=(name,rows)=>{
    const file=resolve(dir,`${name}-${stamp}.json`);
    writeFileSync(file,JSON.stringify({format:'ONSPA-TEST-v1',environment:'TEST',exportedAt:now,sha256:sha256(JSON.stringify(rows)),records:rows},null,2),{flag:'wx'});return file;
  };
  const beforeFile=backup('before-planning',before), writes=[], differences={forecast:[],demand:[]};
  const put=(entity,key,payload,actor='PDF-IMPORT-TEST')=>writes.push(db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(entity,key,JSON.stringify(payload),actor,now));
  for(const rows of input.forecasts){
    const month=rows[0].applicationMonth, old=before.find(r=>r.entity==='forecast'&&r.record_key===month);
    const existing=old?JSON.parse(old.payload):[];
    if(!Array.isArray(existing))throw Error('Unknown forecast payload; no writes');
    const merged=new Map(existing.map(r=>[r.sku,r]));
    differences.forecast.push(...existing.filter(r=>!rows.some(n=>n.sku===r.sku)));
    for(const row of rows)merged.set(row.sku,{...row,d30:row.f30/30,d60:row.f60/60,d90:row.f90/90,used:row.f30/30,warning:''});
    put('forecast',month,[...merged.values()]);
  }
  const previous=before.filter(r=>r.entity==='demand_event').map(r=>({...r,value:JSON.parse(r.payload)}));
  const imported=new Set(input.demand.map(demandKey));
  differences.demand=previous.filter(r=>!imported.has(demandKey(r.value))).map(r=>r.value);
  for(const row of input.demand){
    const matches=previous.filter(r=>demandKey(r.value)===demandKey(row));
    if(matches.length>1)throw Error('Existing duplicate Demand; no writes');
    const key=matches[0]?.record_key||`PDF-DE-${sha256(demandKey(row)).slice(0,24)}`;
    if(matches[0]?.value._deleted)throw Error('Matching deleted Demand requires review; no writes');
    put('demand_event',key,{...row,id:key,updatedAt:now},row.updatedBy);
  }
  // D1 batch is atomic: any failing statement rolls back the complete import.
  await db.batch(writes);
  const after=await records(db),afterFile=backup('after-planning',after);
  for(const expected of input.forecasts) {
    const actual=JSON.parse(after.find(r=>r.entity==='forecast'&&r.record_key===expected[0].applicationMonth).payload);
    for(const row of expected)if(!actual.some(r=>Object.entries(row).every(([k,v])=>r[k]===v)))throw Error('Post-import mismatch');
  }
  const count=rows=>Object.fromEntries([...new Set(rows.map(r=>r.entity))].sort().map(e=>[e,rows.filter(r=>r.entity===e).length]));
  const report={database:'.local-data/d1',databaseId:'onspa-test-local-v1',beforeFile,afterFile,before:count(before),after:count(after),sources:input.sources,differences,sha256:sha256(JSON.stringify(after))};
  const reportFile=resolve(dir,`planning-import-report-${stamp}.json`);writeFileSync(reportFile,JSON.stringify(report,null,2));
  return {...report,reportFile};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(root,'scripts/local/import-planning.mjs')){
 const input=JSON.parse(readFileSync(resolve(root,'.local-data/imports/planning-pdfs.json'),'utf8'));
 const connection=await openDatabase();try{await migrate(connection.db);const result=await importPlanning(connection.db,input);console.log(JSON.stringify(result,null,2));}finally{await connection.close();}
}
