import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
function lookup(rules,date){
 const start=page.indexOf('const activeSafetyRuleFor ='),end=page.indexOf('const safetyBreakdown =',start),context=vm.createContext({safetyRuleSets:rules});
 vm.runInContext(ts.transpileModule(page.slice(start,end)+';globalThis.lookup=activeSafetyRuleFor;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.lookup(date,rules);
}
const previous={id:'SYNTHETIC-V1',version:'V1',status:'Đang áp dụng',effectiveFrom:'2026-10-01',effectiveTo:'',confirmedAt:'2026-10-01T01:00:00Z',leadTimeRules:[{from:1,to:10,days:2,status:'Đang áp dụng'}]};
test('confirming a later Safety version does not remove the proven prior version from its historical business date',()=>{
 const date='2026-10-12',before=lookup([previous],date),ended={...previous,status:'Hết hiệu lực',effectiveTo:'2026-11-04'},next={...previous,id:'SYNTHETIC-V2',version:'V2',effectiveFrom:'2026-11-04',confirmedAt:'2026-11-04T01:00:00Z',leadTimeRules:[{from:1,to:10,days:9,status:'Đang áp dụng'}]},rules=[ended,next],raw=structuredClone(rules);
 assert.equal(lookup(rules,date)?.id,before.id);assert.deepEqual(lookup(rules,date)?.leadTimeRules,before.leadTimeRules);
 assert.equal(lookup(rules,'2026-11-04')?.id,next.id,'newer effective start wins at the existing inclusive boundary');assert.equal(lookup(rules,'2026-11-05')?.id,next.id);assert.equal(lookup(rules,'2026-09-30'),undefined);assert.deepEqual(rules,raw,'lookup is read-only');
});
test('expired Safety without confirmation evidence, cancelled and deleted versions never become historical evidence',()=>{
 for(const invalid of [{...previous,status:'Hết hiệu lực',confirmedAt:''},{...previous,status:'Hết hiệu lực',confirmedAt:'not-a-date'},{...previous,status:'Đã hủy xác nhận'},{...previous,status:'Nháp'},{...previous,_deleted:true}])assert.equal(lookup([invalid],'2026-10-12'),undefined);
 assert.equal(lookup([{...previous,status:'Hết hiệu lực',effectiveTo:'2026-10-20'}],'2026-10-21'),undefined);
});

test('Safety lookup rejects cancellation flags and invalid business intervals without mutating history',()=>{
 for(const invalid of [{...previous,cancelled:true},{...previous,effectiveFrom:'2026-02-30'},{...previous,effectiveFrom:''},{...previous,effectiveTo:'2026-02-30'},{...previous,effectiveTo:'2026-09-30'}])assert.equal(lookup([invalid],'2026-10-12'),undefined);
 for(const date of ['', '2026-02-30','2026-10-12T00:00:00Z'])assert.equal(lookup([previous],date),undefined);
 assert.equal(lookup([{...previous,effectiveTo:'2026-10-12'}],'2026-10-12')?.id,previous.id);
});
