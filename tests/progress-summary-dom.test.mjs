import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {build} from 'vite';import react from '@vitejs/plugin-react';import {JSDOM} from 'jsdom';
test('progress list has plain LSX text and no order disclosure; approval stays in the dedicated queue',async()=>{
 const out=await mkdtemp(join(tmpdir(),'onspa-summary-dom-'));let dom;
 try{await build({configFile:false,define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[react()],logLevel:'error',build:{outDir:out,emptyOutDir:true,lib:{entry:resolve('tests/fixtures/progress-summary.tsx'),name:'ProgressSummaryTest',formats:['iife'],fileName:()=> 'fixture.js'}}});
 dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});dom.window.eval(await readFile(join(out,'fixture.js'),'utf8'));const doc=dom.window.document,settle=()=>new Promise(r=>setTimeout(r,100));await settle();
 const noApproval=()=>{assert.equal(doc.querySelectorAll('input[type=checkbox]').length,0);assert.equal(doc.querySelector('.report-day-review'),null);assert.ok(![...doc.querySelectorAll('button')].some(b=>b.textContent.includes('Xác nhận đã chọn')));};
 assert.equal(doc.querySelectorAll('.progress-order-table > thead > tr > th').length,18);assert.equal(doc.querySelector('.progress-order-table > thead > tr > th').textContent,'LSX');noApproval();
 const cells=[...doc.querySelectorAll('.progress-order-table > tbody > tr > td:first-child')];assert.equal(cells.length,2);
 for(const cell of cells){assert.equal(cell.querySelector('button,a,input'),null);cell.click();await settle();assert.equal(doc.querySelector('.progress-expanded,.progress-order-summary,.progress-tabs,.work-selected'),null);noApproval();}
 [...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Xác nhận báo công')).click();await settle();assert.ok(doc.querySelector('.daily-approval-queue'));assert.equal(doc.querySelector('.progress-order-table'),null);

 }finally{dom?.window.close();await rm(out,{recursive:true,force:true});}
});
