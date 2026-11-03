import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {JSDOM} from 'jsdom';

test('backfill auto-inspection is read-only; exact donor consent saves once and uncertain saves cannot retry',async()=>{
 const out=await mkdtemp(join(tmpdir(),'bf-ui-'));let dom;
 try{
  await build({configFile:false,define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[react()],logLevel:'error',build:{outDir:out,emptyOutDir:true,lib:{entry:resolve('tests/fixtures/production-backfill.tsx'),name:'BF',formats:['iife'],fileName:()=> 'fixture.js'}}});
  const script=await readFile(join(out,'fixture.js'),'utf8');
  for(const uncertain of [false,true]){
   dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
   const w=dom.window,d=w.document,button=t=>[...d.querySelectorAll('button')].find(b=>b.textContent.includes(t));
   const until=async predicate=>{const limit=Date.now()+4000;while(!predicate()){if(Date.now()>limit)assert.fail('Timed out waiting for synthetic UI');await new Promise(r=>setTimeout(r,25));}};
   w.eval(script);w.htmlResponse=true;
   await until(()=>d.querySelector('[role=alert]'));
   assert.match(d.querySelector('[role=alert]').textContent,/Máy chủ chưa trả được kết quả/);assert.doesNotMatch(d.body.textContent,/Unexpected token/);
   w.htmlResponse=false;button('Thử lại kiểm tra').click();await until(()=>d.querySelector('[aria-label="Chọn Nhân viên mẫu B"]'));
   const closed=[...d.querySelectorAll('label')].find(n=>n.textContent.includes('Ghi xuất trạm cùng lúc')).querySelector('input');closed.click();
   await until(()=>d.querySelector('input[type=number]')&&d.querySelector('[aria-label="Chọn Nhân viên mẫu B"]'));
   assert.equal(d.querySelector('input[type=number]').value,'1000');assert.equal(d.querySelector('input[type=number]').max,'1000');
   assert.equal(d.querySelector('[aria-label="Chọn Nhân viên mẫu C"]').disabled,true);
   d.querySelector('[aria-label="Chọn Nhân viên mẫu B"]').click();await until(()=>button('Đồng ý chuyển và lưu'));
   const region=d.querySelector('[aria-label="Ghi nhập bù"]');assert.match(region.textContent,/Nhân viên mẫu B.*LSX-MẪU-02.*ASSY/);
   assert.ok(w.calls.every(c=>c.backfill.mode==='inspect'),'inspection and selection never write');assert.equal(w.saved,0);
   const selected=[...d.querySelectorAll('tbody input:checked')].map(n=>n.getAttribute('aria-label'));
   assert.ok(selected.includes('Chọn Nhân viên mẫu B'));
   w.htmlResponse=uncertain;const save=button('Đồng ý chuyển và lưu');save.click();save.click();
   await until(()=>uncertain?/chưa xác định kết quả|Chưa xác định kết quả/.test(d.body.textContent):w.saved===1);
   const writes=w.calls.filter(c=>c.backfill.mode==='save');assert.equal(writes.length,1);assert.equal(writes[0].backfill.resolveAssignments,true);
   assert.ok(writes[0].backfill.people.includes('B'));assert.deepEqual(JSON.parse(JSON.stringify(writes[0].backfill.confirmedAllocations)).filter(a=>a.employeeId==='B').map(a=>[a.employeeId,a.order,a.stage,a.from,a.to]),[['B','LSX-MẪU-02','ASSY','2026-10-28T07:00:00Z','2026-10-29T01:30:00Z']]);
   assert.equal(w.calls.some(c=>['preview','apply'].includes(c.backfill.mode)),false);
   if(uncertain){assert.equal(w.saved,0);assert.doesNotMatch(d.body.textContent,/Unexpected token/);save.click();button('Thử lại kiểm tra')?.click();await new Promise(r=>setTimeout(r,150));assert.equal(w.calls.filter(c=>c.backfill.mode==='save').length,1);}
   dom.window.close();dom=null;
  }
 }finally{dom?.window.close();await rm(out,{recursive:true,force:true});}
});
