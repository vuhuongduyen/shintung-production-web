// Internal read-only adapter preparation. No route, activation, policy write or CLI.
// A successful inspection is advisory; the eventual commit must revalidate atomically.
import {legacySourceCondition,legacySnapshotSources} from './production-legacy-snapshot.mjs';
import {legacyPublicationArtifactsCondition} from './production-legacy-publication.mjs';
import {dailyToday} from './production-daily-output.mjs';

const capabilities=['earned','reportPresentation','monthlyAttendance','orderMetadata','cutoverMonthAttendance'];
const targets=['production_legacy_basis','production_legacy_month','production_legacy_order'];
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
const parse=raw=>{try{return JSON.parse(raw);}catch{return null;}};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
function completeManifest(m,id,sourceId){
 const p=m?.publication;
 return m?.id===id&&m.captureModel==='observed-source-records-v1'&&m.sourceId===sourceId&&m.status==='complete'
  &&m.cutoverDate===dailyToday()&&integer(m.sourceCount)
  &&JSON.stringify(m.sources)===JSON.stringify(legacySnapshotSources)
  &&capabilities.every(k=>m.scope?.[k]===true)&&Object.values(m.scope).every(v=>v===true)
  &&p&&Array.isArray(p.chunks)&&p.chunks.length<=2048&&p.next===p.chunks.length
  &&p.chunks.every(c=>integer(c.count)&&c.count<=8&&typeof c.hash==='string'&&/^[a-f0-9]{64}$/.test(c.hash))
  &&integer(p.recordCount)&&p.chunks.reduce((n,c)=>n+c.count,0)===p.recordCount
  &&targets.every(e=>integer(p.targetCounts?.[e]))&&targets.reduce((n,e)=>n+p.targetCounts[e],0)===p.recordCount;
}

export async function inspectDailyActivation(db,{snapshotId},actor,{sourceId}={}){
 if(!actor?.isAdmin||actor.line||!actor.login)fail('Chỉ Admin toàn quyền được kiểm tra mốc bảo toàn.',403);
 if(typeof sourceId!=='string'||!/^[a-f0-9]{64}$/.test(sourceId))fail('Thiếu định danh build máy chủ.',503);
 if(typeof snapshotId!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(snapshotId))fail('Định danh snapshot không hợp lệ.',422);
 const result={phase:'read-only-preflight',snapshotId,sourceId,technicalChecksPassed:false,mayActivate:false,requiresAtomicRevalidation:true,productionActivationAvailable:false,blockers:[]};
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?").bind(snapshotId).first();
 if(!row){result.blockers.push('manifest-missing');return result;}
 // Do not parse an unbounded record or return source/employee payloads as diagnostics.
 if(new TextEncoder().encode(row.payload).length>256*1024){result.blockers.push('manifest-over-budget');return result;}
 const manifest=parse(row.payload);
 if(!completeManifest(manifest,snapshotId,sourceId)){result.blockers.push('manifest-ineligible');return result;}
 const source=legacySourceCondition(snapshotId,manifest),artifacts=legacyPublicationArtifactsCondition(snapshotId,manifest.publication),prefix=JSON.stringify([snapshotId]).slice(0,-1)+',';
 // One SQL statement observes manifest, live source, copies, anchors and policy at
 // the same read point. A result must never be used as a later write authorization.
 const checks=await db.prepare(`SELECT
  EXISTS(SELECT 1 FROM app_records WHERE entity='production_legacy_manifest' AND record_key=? AND payload=?) AS manifest_same,
  (${source.sql}) AS source_same,
  ((SELECT count(*) FROM app_records WHERE entity='production_legacy_source' AND record_key>=? AND record_key<?)=?) AS frozen_count_same,
  (${artifacts.sql}) AS artifacts_same,
  NOT EXISTS(SELECT 1 FROM app_records WHERE entity='production_reporting_activation' AND record_key='global') AS activation_absent,
  NOT EXISTS(SELECT 1 FROM app_records WHERE entity='production_reporting_policy' AND record_key='global') AS policy_absent`).bind(snapshotId,row.payload,...source.args,prefix,prefix+'\uffff',manifest.sourceCount,...artifacts.args).first();
 for(const [key,code] of [['manifest_same','manifest-changed'],['source_same','source-changed'],['frozen_count_same','source-copy-incomplete'],['artifacts_same','anchors-changed'],['activation_absent','activation-already-exists'],['policy_absent','policy-already-exists']])if(checks?.[key]!==1)result.blockers.push(code);
 result.technicalChecksPassed=result.blockers.length===0;
 result.cutoverDate=manifest.cutoverDate;
 result.counts={source:manifest.sourceCount,anchors:manifest.publication.recordCount,chunks:manifest.publication.chunks.length};
 return result;
}
