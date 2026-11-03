import test from 'node:test';
import assert from 'node:assert/strict';
import {productionRuntime,reportStart} from '../lib/production-runtime.mjs';
import {productionWorkActions} from '../lib/production-work-actions.mjs';
const order={id:'legacy',lsxQty:2000,inTransitQty:2000,completedQty:0,actualStartedAt:'2026-10-14',progressStatus:'ĐANG SẢN XUẤT'};
const at=Date.parse('2026-10-19T08:00:00Z');
test('running imported order without any output or staff cannot re-enter; can pause and exit',()=>{
 const runtime=productionRuntime(order,[],at);assert.equal(runtime.running,true);assert.equal(runtime.staffingKnown,false);
 const allowed=productionWorkActions(order,[],[],runtime).allowed;assert.ok(!allowed.includes('start'));assert.ok(allowed.includes('pause'));assert.ok(allowed.includes('complete'));
 assert.equal(reportStart(order,[],[]),'','date-only source never invents a clock time');
 assert.equal(productionRuntime(order,[],Date.parse('2026-10-13T08:00:00Z')).running,false);
});
test('legacy stop/resume and live session take precedence; completed stays closed',()=>{
 const pause={sourceId:order.id,kind:'pause',effectiveAt:'2026-10-19T01:00:00Z'};
 const paused=productionRuntime(order,[pause],at);assert.equal(paused.paused,true);assert.deepEqual(productionWorkActions(order,[],[pause],paused).allowed,['resume','incident']);
 assert.equal(productionRuntime(order,[pause,{...pause,kind:'resume',effectiveAt:'2026-10-19T02:00:00Z'}],at).running,true);
 const live=[{...pause,kind:'start',count:2,effectiveAt:'2026-10-18T01:00:00Z'},pause];assert.equal(productionRuntime(order,live,at).running,false);assert.equal(productionRuntime(order,live,at).staffingKnown,true);
 assert.deepEqual(productionWorkActions({...order,inTransitQty:0},[],[],paused).allowed,[]);
});
test('new order only exposes entry and incident',()=>{const waiting={...order,actualStartedAt:'',progressStatus:'CHƯA SẢN XUẤT'};assert.deepEqual(productionWorkActions(waiting,[],[],productionRuntime(waiting,[],at)).allowed,['start','incident']);});
