import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../app/labor-hours-data.json' with {type:'json'};
import report from '../app/labor-hours-import-report.json' with {type:'json'};
import {siteLaborHours,siteLaborHoursHistory} from '../lib/site-labor-hours.mjs';

test('PDF labor-hour import keeps valid zeroes, unique SKUs and an explicit mismatch report',()=>{
 assert.equal(report.pdfRows,419);assert.equal(report.matched,340);assert.equal(report.missing,79);assert.equal(report.duplicates,0);
 assert.equal(data.length,340);assert.equal(new Set(data.map(row=>row.sku)).size,340);assert.ok(data.some(row=>row.laborHour===0));
 assert.equal(data.find(row=>row.sku==='101CTP010').laborHour,0.063);
});

test('D1 labor-hour values overlay the PDF baseline without duplicating product master fields',()=>{
 const rows=siteLaborHours([{key:'101CTP010',payload:{sku:'101CTP010',laborHour:0.075,note:'changed',version:2},updatedBy:'tester',updatedAt:'2026-09-17T01:00:00.000Z'}]);
 const current=rows.find(row=>row.key==='101CTP010');assert.equal(current.payload.laborHour,0.075);assert.equal('name' in current.payload,false);assert.equal('group' in current.payload,false);
 const history=siteLaborHoursHistory([], '101CTP010');assert.equal(history.length,1);assert.equal(history[0].payload.newLaborHour,0.063);
});
