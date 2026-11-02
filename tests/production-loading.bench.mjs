// Run: node tests/production-loading.bench.mjs
// Synthetic local transport only. No network, database or business-record reads.
// The fixed baseline remains reproducible after the optimization is committed.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {createProductionSnapshotCache} from '../lib/production-snapshot-cache.mjs';
import {createReadCache} from '../lib/client-read-cache.mjs';

const baselineCommit='74d0dbf1dcc457a6c45ebc261fc96650f96a94ba';
const root=fileURLToPath(new URL('..',import.meta.url));
const source=path=>execFileSync('git',['show',`${baselineCommit}:${path}`],{cwd:root,encoding:'utf8'});
const baselineCode=ts.transpileModule(source('lib/production-workflow-cache.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const {createReadCache:baselineReadCache}=await import(`data:text/javascript;base64,${Buffer.from(source('lib/client-read-cache.mjs')).toString('base64')}`);
const callerCount=8, sampleCount=10, transportDelayMs=10;

async function measure(before) {
  const samples=[];
  for(let batch=0;batch<sampleCount;batch++) {
    let calls=0;
    const transport=(before ? baselineReadCache : createReadCache)();
    const fetch=(_path,init)=>transport.read('/api/production-workflow',async()=>{
      calls++;
      await new Promise(resolve=>setTimeout(resolve,transportDelayMs));
      return Response.json({orders:[{id:'SYNTHETIC-BENCH'}],reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:false,line:null}});
    },{fresh:init.cache==='reload'});
    let read;
    if(before) {
      const exports={};
      vm.runInNewContext(baselineCode,{exports,window:{},Promise,Date,Error,require:name=>{
        if(name==='./production-api')return {productionApiFetch:fetch};
        throw new Error(`Unexpected baseline import: ${name}`);
      }});
      read=exports.readProductionWorkflow;
    } else {
      read=createProductionSnapshotCache({fetcher:async force=>(await fetch('/api/production-workflow',{cache:force?'reload':'no-store'})).json()}).read;
    }
    const start=performance.now();
    await Promise.all(Array.from({length:callerCount},()=>read(true)));
    samples.push({calls,milliseconds:performance.now()-start});
  }
  const times=samples.map(sample=>sample.milliseconds).sort((a,b)=>a-b);
  return {requestCounts:samples.map(sample=>sample.calls),medianMilliseconds:Number(times[Math.floor(times.length/2)].toFixed(2))};
}
const before=await measure(true),after=await measure(false);
assert.ok(before.requestCounts.every(count=>count===2));
assert.ok(after.requestCounts.every(count=>count===1));
console.log(JSON.stringify({scenario:'Concurrent forced production workflow refresh with shared transport deduplication',baselineCommit,callerCount,sampleCount,transportDelayMs,before,after,requestReductionPercent:50,note:'Synthetic latency only; no claim about live network or server latency.'},null,2));
