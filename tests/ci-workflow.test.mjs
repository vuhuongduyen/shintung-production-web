import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const yaml=createRequire(import.meta.url)('js-yaml');
const source=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8'),ci=yaml.load(source);
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const evaluate=(expression,needs,cancelled=false)=>Function('needs','always','cancelled',`return (${expression.replace(/^\$\{\{\s*|\s*\}\}$/g,'')});`)(needs,()=>true,()=>cancelled);

test('source-sync pushes have one PR validation, while draft PR updates and main pushes remain covered',()=>{
 assert.deepEqual(ci.on.push,{branches:['main']});
 assert.deepEqual(ci.on.pull_request,{branches:['main'],types:['opened','synchronize','reopened']});
 const triggered=(event,branch,action)=>event==='push'?ci.on.push.branches.includes(branch):ci.on.pull_request.branches.includes(branch)&&ci.on.pull_request.types.includes(action);
 assert.equal(Number(triggered('push','source-sync/live-v807-20261102'))+Number(triggered('pull_request','main','synchronize')),1);
 for(const action of ['opened','synchronize','reopened'])assert.equal(triggered('pull_request','main',action),true);
 for(const action of ['ready_for_review','edited'])assert.equal(triggered('pull_request','main',action),false);
 assert.equal(triggered('push','main'),true);assert.equal(triggered('pull_request','other','opened'),false);
 assert.ok(!source.includes('pull_request.draft'),'draft PRs must not be excluded');
});

test('all four existing check identities remain stable, with three complete shards',()=>{
 assert.deepEqual(Object.keys(ci.jobs).sort(),['build-test','typecheck']);
 assert.equal(ci.jobs.typecheck.name,'Kiểm tra kiểu dữ liệu');
 assert.equal(ci.jobs['build-test'].name,'Build và kiểm thử (${{ matrix.shard }}/3)');
 assert.deepEqual(ci.jobs['build-test'].strategy.matrix,{shard:[1,2,3]});assert.equal(ci.jobs['build-test'].strategy['fail-fast'],false);
 const scripts=ci.jobs['build-test'].steps.map(s=>s.run).filter(Boolean);
 assert.ok(scripts.includes('npm run build'));assert.ok(scripts.includes('node scripts/ci/run-tests.mjs ${{ matrix.shard }} 3'));
 assert.doesNotMatch(scripts.join('\n'),/test-name-pattern|skip|ignore|changed.files/i);
});

test('quick contracts and TypeScript gate the expensive shards without weakening the final suite',()=>{
 const steps=ci.jobs.typecheck.steps,quick=steps.findIndex(s=>s.run==='npm run test:ci-contract'),types=steps.findIndex(s=>s.run==='npm run typecheck');
 assert.ok(quick>=0&&types>quick);assert.ok(!steps.some(s=>/npm run build|run-tests\.mjs/.test(s.run||'')));
 assert.equal(pkg.scripts['test:ci-contract'],'node --test --test-concurrency=1 tests/ci-workflow.test.mjs tests/global-action-feedback.test.mjs tests/test-export-isolation.test.mjs');
 assert.equal(ci.jobs['build-test'].needs,'typecheck');
 assert.equal(ci.jobs['build-test'].steps[0].if,"${{ needs.typecheck.result != 'success' }}");
 assert.match(ci.jobs['build-test'].steps[0].run,/exit 1\s*$/);
});

test('failed, skipped or timed-out prechecks report failing shard checks before any checkout/install/build',()=>{
 const job=ci.jobs['build-test'],guard=job.steps[0];
 for(const result of ['failure','skipped','cancelled']){
  const needs={typecheck:{result}};assert.equal(evaluate(job.if,needs),true);
  assert.equal(evaluate(guard.if,needs),true);
  // Subsequent steps retain GitHub's default success() condition; none may
  // override the failing guard and proceed with expensive commands.
  for(const step of job.steps.slice(1))assert.equal(step.if,undefined);
 }
 assert.equal(evaluate(job.if,{typecheck:{result:'success'}},true),false,'a cancelled run must not start another shard');
});

test('a passing gate reaches the unchanged install, build and full-runner commands',()=>{
 const job=ci.jobs['build-test'],needs={typecheck:{result:'success'}};
 assert.equal(evaluate(job.if,needs),true);assert.equal(evaluate(job.steps[0].if,needs),false);
 assert.deepEqual(job.steps.filter(s=>s.run).slice(1).map(s=>s.run),['npm ci --no-audit --no-fund','npm run build','node scripts/ci/run-tests.mjs ${{ matrix.shard }} 3']);
 assert.equal(job['timeout-minutes'],45);assert.equal(ci.jobs.typecheck['timeout-minutes'],15);
 for(const config of Object.values(ci.jobs))assert.equal(config['continue-on-error'],undefined);
});

test('new revisions cancel only older work for that PR or main, not unrelated PRs',()=>{
 assert.equal(ci.concurrency.group,'ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}');assert.equal(ci.concurrency['cancel-in-progress'],true);
 const key=(number,ref)=>ci.concurrency.group.replace(/\$\{\{ github.workflow \}\}/g,ci.name).replace(/\$\{\{ github.event.pull_request.number \|\| github.ref \}\}/g,number||ref);
 assert.equal(key(7,'refs/pull/7/merge'),key(7,'refs/pull/7/head'));assert.notEqual(key(7,''),key(8,''));assert.notEqual(key(7,''),key(null,'refs/heads/main'));
});

test('CI keeps readonly permissions, locked Node24 dependencies and pinned non-deployment actions',()=>{
 assert.deepEqual(ci.permissions,{contents:'read'});assert.equal(ci.on.pull_request_target,undefined);
 for(const job of Object.values(ci.jobs)){
  const checkout=job.steps.find(s=>s.uses?.startsWith('actions/checkout@')),node=job.steps.find(s=>s.uses?.startsWith('actions/setup-node@'));
  assert.match(checkout.uses,/@[a-f0-9]{40}$/);assert.equal(checkout.with['persist-credentials'],false);assert.match(node.uses,/@[a-f0-9]{40}$/);assert.equal(node.with['node-version'],'24');assert.equal(node.with.cache,'npm');
 }
 assert.doesNotMatch(source,/secrets\.|pull_request_target|continue-on-error|workflow_dispatch|deploy|skip.ci|paths-ignore/);
});
