import {parentPort} from 'node:worker_threads';
import {importLaborReferenceSnapshot} from '../../scripts/local/production-labor-reference-import.mjs';
const pending=new Map();let seq=0,peak=0,exceeded=false;
function sample(){const m=process.memoryUsage();peak=Math.max(peak,m.heapUsed+m.external);if(peak>128*1024*1024)exceeded=true;}
const timer=setInterval(sample,2);timer.unref();
function rpc(op,sql,args){sample();return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});parentPort.postMessage({type:'db',id,op,sql,args});});}
class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args;}bind(...args){return new Statement(this.sql,args);}all(){return rpc('all',this.sql,this.args);}first(){return rpc('first',this.sql,this.args);}run(){return rpc('run',this.sql,this.args);}}
const db={prepare:sql=>new Statement(sql),batch:statements=>rpc('batch',null,statements.map(s=>({sql:s.sql,args:s.args})))};
parentPort.on('message',async message=>{
 if(message.type==='db-result'){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(Error(message.error)):p.resolve(message.value);return;}
 if(message.type==='run')try{
  const result=await importLaborReferenceSnapshot(db,message.body,{isAdmin:true,login:'SYNTHETIC-REVIEWER',grants:[]},{hostname:'onspa-thu-nghiem.shintung-vn-4458.chatgpt.site'});
  sample();parentPort.postMessage({type:'result',result,peakBytes:peak,exceeded});
 }catch(e){sample();parentPort.postMessage({type:'result',error:e.message,status:e.status,peakBytes:peak,exceeded});}
});
