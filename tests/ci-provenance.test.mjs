import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ciSource,reportCiSource} from '../scripts/ci/provenance.mjs';

function fixture(){
 const cwd=mkdtempSync(join(tmpdir(),'onspa-ci-source-'));
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','--initial-branch=main');git('config','user.name','Synthetic CI');git('config','user.email','synthetic@example.invalid');
 writeFileSync(join(cwd,'app.mjs'),'export default 1;\n');git('add','app.mjs');git('commit','-m','synthetic baseline');const base=git('rev-parse','HEAD');
 git('checkout','-b','feature/synthetic');writeFileSync(join(cwd,'app.mjs'),'export default 2;\n');git('commit','-am','synthetic change');const head=git('rev-parse','HEAD');
 git('checkout','main');git('merge','--no-ff','feature/synthetic','-m','synthetic PR merge');const checkout=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
 const event={pull_request:{base:{ref:'staging',sha:base},head:{sha:head},body:'SYNTHETIC-NOT-FOR-LOGS'},credentials:'SYNTHETIC-NOT-FOR-LOGS'};
 const environment={GITHUB_EVENT_NAME:'pull_request',GITHUB_SHA:checkout,GITHUB_REF:'refs/pull/999/merge'};
 return {cwd,base,head,checkout,tree,event,environment,close:()=>rmSync(cwd,{recursive:true,force:true})};
}

test('CI records the actual merge tree and distinguishes PR head/base for both target branches',()=>{
 const f=fixture();try{for(const branch of ['staging','main']){
  const actual=ciSource({...f,event:{pull_request:{...f.event.pull_request,base:{ref:branch,sha:f.base}}}});
  assert.deepEqual(actual,{event:'pull_request',checkout:f.checkout,tree:f.tree,base:f.base,baseBranch:branch,head:f.head});
  assert.notEqual(actual.checkout,actual.head);
 }}finally{f.close();}
});

test('CI fails closed on stale head/base, a head-only checkout, invalid SHA or unsupported target/event',()=>{
 const f=fixture();try{
  assert.throws(()=>ciSource({...f,environment:{...f.environment,GITHUB_SHA:f.head}}),/checkout/);
  for(const event of [
   {pull_request:{base:{ref:'other',sha:f.base},head:{sha:f.head}}},
   {pull_request:{base:{ref:'staging',sha:f.head},head:{sha:f.head}}},
   {pull_request:{base:{ref:'staging',sha:f.base},head:{sha:f.base}}},
   {pull_request:{base:{ref:'staging',sha:'not-a-sha'},head:{sha:f.head}}}
  ])assert.throws(()=>ciSource({...f,event}),/Invalid|parents/);
  assert.throws(()=>ciSource({...f,environment:{...f.environment,GITHUB_EVENT_NAME:'pull_request_target'}}),/Unsupported/);
 }finally{f.close();}
});

test('CI summary contains only source identities, never arbitrary event content or credentials',()=>{
 const f=fixture();try{
  const summary=join(f.cwd,'summary.md');const output=reportCiSource({...f,environment:{...f.environment,GITHUB_STEP_SUMMARY:summary}});
  assert.deepEqual(JSON.parse(output.slice('CI SOURCE: '.length)),ciSource(f));
  const written=readFileSync(summary,'utf8');assert.ok(written.includes(f.tree));assert.ok(written.includes(f.checkout));
  assert.doesNotMatch(output+written,/SYNTHETIC-NOT-FOR-LOGS|credentials|pull_request_target/);
 }finally{f.close();}
});

test('main pushes are identified without inventing a PR or accepting an unvalidated branch push',()=>{
 const f=fixture();try{
  const environment={GITHUB_SHA:f.checkout,GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main'};
  assert.deepEqual(ciSource({...f,environment}),{event:'push',checkout:f.checkout,tree:f.tree,base:null,baseBranch:'main',head:f.checkout});
  assert.throws(()=>ciSource({...f,environment:{...environment,GITHUB_REF:'refs/heads/staging'}}),/Unexpected/);
 }finally{f.close();}
});

test('CI validates the default depth-one checkout without fetching more history',()=>{
 const f=fixture();try{
  const cwd=join(f.cwd,'depth-one');
  execFileSync('git',['clone','--depth=1','--branch','main','--no-tags',pathToFileURL(f.cwd).href,cwd],{stdio:['ignore','pipe','pipe']});
  const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
  assert.equal(git('rev-parse','--is-shallow-repository'),'true');
  assert.equal(git('show','--no-patch','--format=%P','HEAD'),'','revision walking hides shallow boundary parents');
  assert.deepEqual(ciSource({...f,cwd}),{event:'pull_request',checkout:f.checkout,tree:f.tree,base:f.base,baseBranch:'staging',head:f.head});
 }finally{f.close();}
});
