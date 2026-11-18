import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
test('built Worker rejects old-tab and Sheet writes without touching synthetic DB/R2 or network',async()=>{
  const dir=resolve('dist/server'),entry=resolve(dir,'index.js');
  const paths=readdirSync(dir,{recursive:true}).filter(p=>/\.(?:m?js)$/.test(p)).map(p=>resolve(dir,p));
  let outbound=0;
  const mf=new Miniflare({modules:[entry,...paths.filter(p=>p!==entry)].map(path=>({type:'ESModule',path})),modulesRoot:dir,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'synthetic-maintenance'},r2Buckets:['FILES'],cf:false,outboundService:()=>{outbound++;return new Response('blocked',{status:503});}});
  try{
    const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('FILES');
    // Initialize D1's lazy internal metadata before taking the baseline.
    await db.prepare('CREATE TABLE app_records(entity TEXT, record_key TEXT, payload TEXT, updated_by TEXT, updated_at TEXT)').run();
    await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit','SYNTHETIC','{"completedQty":400,"pendingReportQty":200}','SYNTHETIC','2026-11-14').run();
    const rowsBefore=(await db.prepare('SELECT * FROM app_records').all()).results;
    const schemaBefore=(await db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).results;
    for(const path of ['/api/production-workflow','/api/production-report','/api/warehouse-confirm','/api/warehouse-sheet/bridge','/api/production-correction','/api/capacity','/api/active-viewers','/api/in-transit','/api/records','/api/source-sync/devices']){
      const response=await mf.dispatchFetch('https://sanxuat.shintung-vn-4458.chatgpt.site'+path,{method:'POST',headers:{'content-type':'application/json'},body:'{"synthetic":true}'});
      assert.equal(response.status,423,path);assert.equal((await response.json()).code,'ONSPA_MAINTENANCE_LOCKED');
    }
    const home=await mf.dispatchFetch('https://sanxuat.shintung-vn-4458.chatgpt.site/');assert.equal(home.status,503);assert.match(await home.text(),/ONSPA đang bảo trì/);
    assert.deepEqual((await db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).results,schemaBefore);
    assert.deepEqual((await db.prepare('SELECT * FROM app_records').all()).results,rowsBefore);
    assert.equal((await bucket.list()).objects.length,0);assert.equal(outbound,0);
  }finally{await mf.dispose();}
});
