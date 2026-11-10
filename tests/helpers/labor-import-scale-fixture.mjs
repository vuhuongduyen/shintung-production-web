import assert from 'node:assert/strict';
import {reviewer} from './daily-output-reviewer.mjs';
import {previewFixedLaborReferences} from '../../lib/production-labor-reference-snapshot.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
export async function laborImportScaleDataset(c){
 for(let i=0;i<139;i++)await c.put('production_report','SYNTHETIC-MEM-'+i,{id:'SYNTHETIC-MEM-'+i,transitId:c.order.id,kind:'completion',sku:c.order.sku,orderSnapshot:c.order,line:'A',version:1,stageName:'FINAL',reviewStatus:'Đã xác nhận',approvedQuantity:100,reportedQuantity:100,completedAt:'2026-11-02T03:00:00Z',hours:{hc:3,ot:1,total:4}});
 const call=await reviewer(c),w=await call('/api/production-workflow'),m=await call('/api/records?entity=labor_hours');
 const p=await previewFixedLaborReferences({reports:w.body.reports,orders:w.body.orders,menu:siteLaborHours(m.body.records),observedAt:'2026-11-10T00:00:00Z'});
 assert.equal(p.manifest.entries.length,139);
 const existing=(await c.db.prepare('SELECT count(*) AS n FROM app_records').first()).n;
 for(let start=existing;start<16197;start+=100){const statements=[];for(let i=start;i<Math.min(16197,start+100);i++)statements.push(c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('website_action_audit','SYNTHETIC-SCALE-'+i,JSON.stringify({id:i,note:'x'.repeat(2048),source:'SYNTHETIC',version:i}),'SYNTHETIC','2026-11-01'));await c.db.batch(statements);}
 return {action:'preview',manifest:p.manifest,omissions:[]};
}
