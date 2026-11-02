import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {reconcileBomPdf} from '../scripts/local/bom-reconciliation.mjs';
import {reconcileBom} from '../lib/bom-reconciliation.mjs';
import manifest from '../data/bom-pdf-20260930.json' with {type:'json'};
import baseline from '../app/bom-data.json' with {type:'json'};
const actor={login:'admin@example.test',isAdmin:true};
const get=sku=>structuredClone(baseline.find(b=>b.sku===sku));
test('PDF quantities are direct parent ratios, with scrap separated and cost waste preserved',()=>{
 const root=reconcileBom(get('102XS02001'),manifest).next;
 assert.equal(root.items.find(i=>i.code==='3060105').qty,'0.027');assert.equal(root.items.find(i=>i.code==='3060105').waste,'1.3%');
 const hose=reconcileBom(get('3060105'),manifest).next;
 assert.equal(hose.items.find(i=>i.code==='3060202').qty,'0.497');assert.equal(hose.items.find(i=>i.code==='3060202').waste,'1%');
 const resin=reconcileBom(get('3060202'),manifest).next;assert.equal(resin.items[0].qty,'1');assert.equal(resin.items[0].waste,'2%');
 for(const p of manifest.patches.filter(p=>p.excluded)){const before=get(p.sku);if(!before)continue;const item=before.items.find(i=>i.code===p.code);if(!item)continue;const after=reconcileBom(before,manifest).next.items.find(i=>i.code===p.code);assert.equal(after.qty,item.qty);assert.equal(after.waste,item.waste);assert.equal(after.denominator,item.denominator);}
});
test('full spec, duplicates and approved denominators survive repeated reconciliation',()=>{
 const b=get('102IC03001'),tie=b.items.find(i=>i.code==='5010304');tie.qty='1';tie.denominator='10';
 const a=reconcileBom(b,manifest);assert.equal(a.next.items.find(i=>i.code==='5010304').qty,'1');assert.equal(a.next.items.find(i=>i.code==='5010304').denominator,'10');assert.equal(a.next.items.find(i=>i.code==='3060701').spec,'TN GF00102 & NPF00102');
 assert.equal(reconcileBom(a.next,manifest).changes.length,0);
 assert.equal(reconcileBom(get('103S101101'),manifest).next.items.find(i=>i.code==='5010021').qty,'0.0006');
 for(const blocked of manifest.blocked){const base=get(blocked.parent);if(!base)continue;const old=base.items.find(i=>i.code===blocked.code),next=reconcileBom(base,manifest).next.items.find(i=>i.code===blocked.code);if(old){assert.equal(next.qty,old.qty);assert.equal(next.waste,old.waste);}}
});
test('Admin-only explicit batches keep audit backups, are idempotent and reject stale data',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/bom-pdf-')));await migrate(c.db);
 try{
 await assert.rejects(reconcileBomPdf(c.db,{action:'preview'},{login:'user',isAdmin:false}),e=>e.status===403);
 const preview=await reconcileBomPdf(c.db,{action:'preview'},actor),selected=preview.boms.filter(b=>['102XS02001','3060105'].includes(b.sku));assert.equal(selected.length,2);
 const body={action:'apply',id:preview.id,skus:selected.map(b=>b.sku),expectedRevisions:Object.fromEntries(selected.map(b=>[b.sku,b.revision]))};
 const result=await reconcileBomPdf(c.db,body,actor);assert.equal(result.count,2);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,2);
 const audit=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit' LIMIT 1").first()).payload);assert.ok(audit.before.items.length);assert.ok(audit.after.items.length);assert.equal(audit.sha256,manifest.sha256);
 const after=await reconcileBomPdf(c.db,{action:'preview'},actor);assert.ok(!after.boms.some(b=>selected.some(s=>s.sku===b.sku)));
 await assert.rejects(reconcileBomPdf(c.db,body,actor),e=>e.status===409);
 const next=after.boms.slice(0,2),stale={action:'apply',id:after.id,skus:next.map(b=>b.sku),expectedRevisions:Object.fromEntries(next.map(b=>[b.sku,b.revision]))};
 await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('bom',next[1].sku,JSON.stringify(get(next[1].sku)),actor.login,'changed').run();
 await assert.rejects(reconcileBomPdf(c.db,stale,actor),e=>e.status===409);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='bom_pdf_guard'").first()).n,0);
 }finally{await c.close();}
});
