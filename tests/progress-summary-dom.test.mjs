import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {build} from 'vite';import react from '@vitejs/plugin-react';import {JSDOM} from 'jsdom';
test('progress list and LSX details are read-only; approval controls exist only in the dedicated queue',async()=>{
 const out=await mkdtemp(join(tmpdir(),'onspa-summary-dom-'));let dom;
 try{await build({configFile:false,define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[react()],logLevel:'error',build:{outDir:out,emptyOutDir:true,lib:{entry:resolve('tests/fixtures/progress-summary.tsx'),name:'ProgressSummaryTest',formats:['iife'],fileName:()=> 'fixture.js'}}});
 dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});dom.window.eval(await readFile(join(out,'fixture.js'),'utf8'));const doc=dom.window.document,settle=()=>new Promise(r=>setTimeout(r,100));await settle();
 const orderButtons=()=>[...doc.querySelectorAll('button.production-order-link')],overview=()=>doc.querySelector('.progress-order-summary'),toggle=()=>doc.querySelector('.progress-detail-toolbar .progress-overview-toggle');
 const noApproval=()=>{assert.equal(doc.querySelectorAll('input[type=checkbox]').length,0);assert.equal(doc.querySelector('.report-day-review'),null);assert.ok(![...doc.querySelectorAll('button')].some(b=>b.textContent.includes('Xác nhận đã chọn')));};
 assert.equal(doc.querySelectorAll('.progress-order-table > thead > tr > th').length,18);assert.equal(doc.querySelector('.progress-order-table > thead > tr > th').textContent,'LSX');noApproval();
 orderButtons()[0].click();await settle();assert.equal(overview().hidden,false);noApproval();assert.match(overview().textContent,/Kế hoạch và tiến độ/);
 [...doc.querySelectorAll('[role=tab]')].find(b=>b.textContent.startsWith('Báo công')).click();await settle();assert.ok(doc.querySelector('.production-report-history'));assert.ok(doc.querySelectorAll('.production-report-history tbody tr').length);noApproval();
 orderButtons()[1].click();await settle();assert.equal(overview().hidden,false);assert.match(doc.querySelector('.work-selected').textContent,/TEST-SECOND/);noApproval();
 [...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Xác nhận báo công')).click();await settle();assert.ok(doc.querySelector('.daily-approval-queue'));assert.equal(doc.querySelector('.progress-order-table'),null);

 }finally{dom?.window.close();await rm(out,{recursive:true,force:true});}
});
