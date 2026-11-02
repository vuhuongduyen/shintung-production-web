import test from 'node:test';import assert from 'node:assert/strict';
import {productionOverlapRows} from '../lib/production-overlap-report.mjs';
const at=h=>`2026-10-30T${h}:00+07:00`,report=(id,from,to)=>({id,kind:'completion',transitId:id,line:'A',stageName:'CUT',startedAt:at(from),completedAt:at(to),hours:{staffing:[{from:at(from),to:at(to),employees:['N']}]}});
test('overlap report uses half-open intervals, merges duplicates, excludes cancelled reports and filters dates',()=>{
 const args={orders:[{id:'A',lsxCode:'A'},{id:'B',lsxCode:'B'},{id:'C',lsxCode:'C'}],employees:[{id:'N',name:'Nhân viên'}],reports:[report('A','08:00','10:00'),report('B','09:00','11:00'),{...report('C','08:00','11:00'),cancelled:true}],from:'2026-10-30',to:'2026-10-30'};
 const result=productionOverlapRows(args);assert.equal(result.length,1);assert.equal(result[0].minutes,60);assert.equal(result[0].employeeName,'Nhân viên');
 assert.equal(productionOverlapRows({...args,reports:[report('A','08:00','09:00'),report('B','09:00','11:00')]}).length,0);
 assert.equal(productionOverlapRows({...args,from:'2026-10-29',to:'2026-10-29'}).length,0);
});
