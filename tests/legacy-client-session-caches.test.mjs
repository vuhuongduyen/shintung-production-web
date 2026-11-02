import nodeTest, {after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {createServer} from 'vite';

const test=(name,body)=>nodeTest(name,{timeout:10_000},body);

// Real browser adapters, synthetic responses only. No application server or DB.
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({appType:'custom', configFile:false, root, resolve:{alias:{'@':resolve(root)}}, server:{middlewareMode:true}});
after(() => vite.close());
const sync = await vite.ssrLoadModule('/lib/data-sync.ts');
const records = await vite.ssrLoadModule('/lib/record-fetch.ts');
const plan = await vite.ssrLoadModule('/components/production-plan.tsx');
const transit = await vite.ssrLoadModule('/components/in-transit.tsx');
const {normalizeRow} = await vite.ssrLoadModule('/lib/production-plan.mjs');
const {clientAuthorizationKey} = await vite.ssrLoadModule('/lib/client-authorization-context.mjs');
const savedFetch = globalThis.fetch, savedWindow = globalThis.window, savedChannel = globalThis.BroadcastChannel;
const week = '2026-10-12';
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; };
const cancelled = promise => assert.rejects(promise, error => sync.isClientSessionReadCancelled(error));
const render = (component, props={}) => renderToStaticMarkup(React.createElement(component,props));
const planData = label => ({revision:1,rows:[normalizeRow({id:label,sku:label,name:label,line:'A',plan:1,laborHour:1},week)],sources:[],capacity:[],transit:[],audit:[],warnings:[],canReopen:false});
const transitData = label => ({rows:[{id:label,sku:label,name:label,week,line:'A',status:'DỰ KIẾN'}],history:[]});
const skuData = label => ({records:[{key:label,payload:{code:label,name:label}}]});

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {location:{origin:'https://synthetic.test'}});
  globalThis.BroadcastChannel = class { postMessage() {} close() {} };
  globalThis.fetch = async input => {throw new Error(`Unexpected synthetic request: ${input}`);};
  sync.clearClientReads();
});
afterEach(() => {
  sync.clearClientReads();
  globalThis.fetch = savedFetch;
  globalThis.BroadcastChannel = savedChannel;
  if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
});

// Keep native Responses and clone semantics, but control the asynchronous JSON
// boundary. Counting decode calls catches a stale finally deleting a new promise
// even when the shared HTTP cache masks the extra loader invocation.
function delayedJson(body) {
  const gate = deferred(), started = deferred();
  let decodes = 0;
  const decorate = response => {
    const json = response.json.bind(response), clone = response.clone.bind(response);
    Object.defineProperty(response,'json',{configurable:true,value:async()=>{decodes++;started.resolve();await gate.promise;return json();}});
    Object.defineProperty(response,'clone',{configurable:true,value:()=>decorate(clone())});
    return response;
  };
  return {response:decorate(Response.json(body)),started:started.promise,finish:()=>gate.resolve(),get decodes(){return decodes;}};
}

for (const kind of ['plan','transit']) {
  const prefetch = () => kind === 'plan' ? plan.prefetchProductionPlan(week) : transit.prefetchInTransit();
  const path = kind === 'plan' ? `/api/production-plan?week=${week}` : '/api/in-transit';
  const body = kind === 'plan' ? planData : transitData;
  const view = () => kind === 'plan' ? render(plan.ProductionPlan,{initialWeek:week}) : render(transit.InTransit);

  test(`${kind}: account reset removes retained data before the next browser render`, async () => {
    let account='SYNTHETIC-ACCOUNT-A', calls=0;
    globalThis.fetch=async input=>{calls++;return Response.json(input===path?body(account):skuData(account));};
    await prefetch(); assert.match(view(),/SYNTHETIC-ACCOUNT-A/);
    const before=calls; await prefetch(); assert.equal(calls,before,'same-session prefetched data stays reusable');
    sync.clearClientReads(); account='SYNTHETIC-ACCOUNT-B';
    assert.doesNotMatch(view(),/SYNTHETIC-ACCOUNT-A/);
    await prefetch(); assert.match(view(),/SYNTHETIC-ACCOUNT-B/); assert.ok(calls>before);
  });

  for (const phase of ['headers','JSON decode']) test(`${kind}: old ${phase} completion rejects and cannot repopulate the new session`, async () => {
    const old = phase==='headers' ? deferred() : delayedJson(body('SYNTHETIC-OLD'));
    let account='old',calls=0;
    globalThis.fetch=async input=>{
      if(input!==path)return Response.json(skuData(account));
      calls++;
      return account==='old' ? (phase==='headers'?old.promise:old.response) : Response.json(body('SYNTHETIC-CURRENT'));
    };
    const before=prefetch(), rejected=cancelled(before);
    if(phase==='JSON decode')await old.started; else await tick();
    sync.clearClientReads(); account='new'; await prefetch();
    if(phase==='headers')old.resolve(Response.json(body('SYNTHETIC-OLD'))); else old.finish();
    await rejected; assert.match(view(),/SYNTHETIC-CURRENT/); assert.doesNotMatch(view(),/SYNTHETIC-OLD/);
    await prefetch(); assert.equal(calls,2);
  });

  test(`${kind}: an old finally cannot discard the new session's pending loader`, async () => {
    const old=delayedJson(body('SYNTHETIC-OLD')), current=delayedJson(body('SYNTHETIC-CURRENT'));
    let account='old',calls=0;
    globalThis.fetch=async input=>{if(input!==path)return Response.json(skuData(account));calls++;return account==='old'?old.response:current.response;};
    const before=prefetch(), rejected=cancelled(before); await old.started;
    sync.clearClientReads(); account='new'; const fresh=prefetch(); await current.started;
    old.finish(); await rejected;
    const joined=prefetch(); await tick();
    assert.equal(current.decodes,1,'new retained promise remains the sole decoder');
    current.finish(); await Promise.all([fresh,joined]); assert.equal(calls,2);
  });

  test(`${kind}: ordinary mutation preserves the session while transit refreshes stale quantities`, async () => {
    const pending=delayedJson(body('SYNTHETIC-SAME-SESSION')); let calls=0;
    let changed=false;
    globalThis.fetch=async input=>{calls++;return input===path?(changed?Response.json(body('SYNTHETIC-CURRENT')):pending.response):Response.json(skuData('SYNTHETIC-SAME-SESSION'));};
    const before=prefetch(); await pending.started;
    const session=sync.clientSessionGeneration(); changed=true;sync.clearClientReads('mutation');
    assert.equal(sync.clientSessionGeneration(),session);
    pending.finish(); await before; const completedCalls=calls;
    assert.match(view(),kind==='transit'?/SYNTHETIC-CURRENT/:/SYNTHETIC-SAME-SESSION/); await prefetch(); assert.equal(calls,completedCalls);
  });

  test(`${kind}: SSR never reuses or populates a retained browser snapshot`, async () => {
    globalThis.fetch=async input=>Response.json(input===path?body('SYNTHETIC-BROWSER'):skuData('SYNTHETIC-BROWSER'));
    await prefetch(); delete globalThis.window;
    let calls=0; globalThis.fetch=async input=>{calls++;return Response.json(input===path?body(`SYNTHETIC-SSR-${calls}`):skuData('SYNTHETIC-SSR'));};
    assert.doesNotMatch(view(),/SYNTHETIC-BROWSER/);
    await prefetch(); const first=calls; await prefetch(); assert.equal(calls,first*2);
    assert.doesNotMatch(view(),/SYNTHETIC-(?:BROWSER|SSR)/);
  });
}

for(const route of ['/api/production-report','/api/production-correction'])test(`In Transit closed/reopened after ${route} refreshes quantity without dropping the retained table`,async()=>{
 let changed=false,gets=0;const changes=[];
 window.addEventListener('onspa-data-changed',event=>changes.push(event.detail));
 globalThis.fetch=async input=>{
  if(input===route){changed=true;return Response.json({ok:true});}
  if(input==='/api/in-transit'){gets++;return Response.json(transitData(changed?'SYNTHETIC-CURRENT-3000-1000':'SYNTHETIC-OLD-0-4000'));}
  return Response.json({records:[]});
 };
 await transit.prefetchInTransit();
 await sync.apiFetch(route,{method:'POST',body:JSON.stringify({action:'review',reportId:'SYNTHETIC',approve:true})});
 assert.ok(changes.flat().includes('in_transit'));
 assert.match(render(transit.InTransit),/SYNTHETIC-OLD-0-4000/,'keep visible rows until the replacement succeeds');
 await transit.prefetchInTransit();
 assert.match(render(transit.InTransit),/SYNTHETIC-CURRENT-3000-1000/);assert.doesNotMatch(render(transit.InTransit),/SYNTHETIC-OLD-0-4000/);
 assert.equal(gets,2);
});

for(const oldFails of [false,true])test(`In Transit pre-write ${oldFails?'failure':'success'} cannot replace a newer successful snapshot`,async()=>{
 const old=deferred();let generation=0,gets=0;
 globalThis.fetch=async input=>{
  if(input!=='/api/in-transit')return Response.json({records:[]});gets++;
  return generation===0?old.promise:Response.json(transitData('SYNTHETIC-CURRENT'));
 };
 const pending=transit.prefetchInTransit();await tick();generation++;
 sync.clearClientReads('mutation');await transit.prefetchInTransit();
 if(oldFails)old.reject(new Error('SYNTHETIC OLD FAILURE'));else old.resolve(Response.json(transitData('SYNTHETIC-OLD')));
 await pending;
 assert.match(render(transit.InTransit),/SYNTHETIC-CURRENT/);assert.doesNotMatch(render(transit.InTransit),/SYNTHETIC-OLD/);assert.equal(gets,2);
});

test('In Transit failed post-write refresh retains prior rows and retries on reopen',async()=>{
 let version=0;
 globalThis.fetch=async input=>input==='/api/in-transit'?(version===1?Response.json({error:'SYNTHETIC 503'},{status:503}):Response.json(transitData(version===0?'SYNTHETIC-OLD':'SYNTHETIC-CURRENT'))):Response.json({records:[]});
 await transit.prefetchInTransit();version=1;sync.clearClientReads('mutation');
 await assert.rejects(()=>transit.prefetchInTransit(),/SYNTHETIC 503/);
 assert.match(render(transit.InTransit),/SYNTHETIC-OLD/);
 version=2;await transit.prefetchInTransit();assert.match(render(transit.InTransit),/SYNTHETIC-CURRENT/);
});

test('In Transit stale in-flight completion propagates one current failure without retrying it again',async()=>{
 const old=delayedJson(transitData('SYNTHETIC-OLD'));let changed=false,gets=0;
 globalThis.fetch=async input=>{
  if(input!=='/api/in-transit')return Response.json({records:[]});gets++;
  return changed?Response.json({error:'SYNTHETIC CURRENT 503'},{status:503}):old.response;
 };
 const before=transit.prefetchInTransit();await old.started;changed=true;sync.clearClientReads('mutation');
 const rejected=assert.rejects(before,/SYNTHETIC CURRENT 503/);old.finish();await rejected;
 assert.equal(gets,2,'obsolete loader must not retry the replacement failure');
});

test('in-transit SKU catalog: late old decode cannot restore catalog or remove its new pending promise',async()=>{
  const old=delayedJson(skuData('SYNTHETIC-OLD-CATALOG')), current=delayedJson(skuData('SYNTHETIC-NEW-CATALOG'));
  let account='old',catalogCalls=0;
  globalThis.fetch=async input=>{if(input==='/api/in-transit')return Response.json({rows:[],history:[]});catalogCalls++;return account==='old'?old.response:current.response;};
  const before=transit.prefetchInTransit(),rejected=cancelled(before); await old.started;
  sync.clearClientReads(); account='new'; const fresh=transit.prefetchInTransit(); await current.started;
  old.finish(); await rejected; const joined=transit.prefetchInTransit(); await tick();
  assert.equal(current.decodes,1); current.finish(); await Promise.all([fresh,joined]);
  await transit.prefetchInTransit(); assert.equal(catalogCalls,2);
});

test('production-plan discovery cannot prefetch an old account week after delayed Engine JSON',async()=>{
  const old=delayedJson({records:[{payload:{week}}]}); const paths=[];
  globalThis.fetch=async input=>{paths.push(input);return old.response;};
  const before=plan.prefetchProductionPlan(),rejected=cancelled(before);await old.started;
  sync.clearClientReads();old.finish();await rejected;
  assert.deepEqual(paths,['/api/records?entity=production_engine']);
});

// app/page intentionally keeps these helpers private. Extract their actual
// TypeScript declarations instead of exporting test-only production APIs or
// importing the entire seeded page/component graph. Business transforms and
// LOCAL_TEST fixtures are irrelevant to session lifecycle, so are kept minimal.
const pageSource=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const pageAst=ts.createSourceFile('page.tsx',pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=new Map();
for(const statement of pageAst.statements){
  if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name))declarations.set(declaration.name.text,statement);
  if(ts.isFunctionDeclaration(statement)&&statement.name)declarations.set(statement.name.text,statement);
}
const retainedNames=['inventorySnapshotsCache','inventoryImportsCache','planningSessionCache','demandEventSessionCache','forecastRecordsCache','productionEngineRecordsCache','systemUsersCache','departmentRecordsCache','permissionRecordsCache'];
const pendingNames=['inventorySnapshotsPromise','inventoryImportsPromise','forecastRecordsPromise','productionEngineRecordsPromise','systemUsersPromise','departmentRecordsPromise','permissionRecordsPromise'];
const loaderNames=['loadInventoryImports','loadInventorySnapshots','loadForecastRecords','loadProductionEngineRecords','loadSystemUsers','loadDepartments','loadPermissionRecords'];
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function pageHarness(){
  const cleanups=[];
  const bindings={...sync,...records,clientAuthorizationKey,LOCAL_TEST:false,calculateForecastDemand:value=>value,initialSystemUsers:[],initialPermissionRecords:[],proposalRows:[],baseForecastData:[],demandEventData:[],leadtimeData:[{sku:'SYNTHETIC-BASELINE',leadTime:3}],originalBomCatalog:[{sku:'SYNTHETIC-BASELINE',items:[]}],bomChanges18092026:[],bomBathBagChanges18092026:[],
    subscribeClientReadInvalidation:listener=>{const stop=sync.subscribeClientReadInvalidation(listener);cleanups.push(stop);return stop;},
  };
  const selected=new Set();
  function include(statement){
    if(selected.has(statement))return;selected.add(statement);
    function visit(node){if(ts.isIdentifier(node)&&!Object.hasOwn(bindings,node.text)&&declarations.has(node.text))include(declarations.get(node.text));ts.forEachChild(node,visit);}
    visit(statement);
  }
  const publicNames=[...retainedNames,...pendingNames,...loaderNames,'workspaceIdentityKey','updatePlanningSessionCacheForSession'];
  for(const name of publicNames){assert.ok(declarations.has(name),`missing private declaration: ${name}`);include(declarations.get(name));}
  const subscriptions=pageAst.statements.filter(statement=>ts.isExpressionStatement(statement)&&statement.getText(pageAst).startsWith('subscribeClientReadInvalidation('));
  assert.ok(subscriptions.length,'the page retained caches must subscribe to session invalidation');
  for(const statement of subscriptions)include(statement);
  const code=pageAst.statements.filter(statement=>selected.has(statement)).map(statement=>statement.getText(pageAst)).join('\n');
  const api=new Function(...Object.keys(bindings),transpile(`${code}\nreturn {
    ${loaderNames.join(',')},workspaceIdentityKey,updatePlanningSessionCacheForSession,
    snapshot:()=>({${[...retainedNames,...pendingNames].join(',')}}),
    seedRetained:value=>{${[...retainedNames,...pendingNames].map(name=>`${name}=value;`).join('')}},
    derivedSnapshot:()=>structuredClone({leadtimeBySku,safetyDaysBySku,safetyRuleSets,bomCatalog,bomChangeHistory}),
    seedDerived:()=>{
      leadtimeBySku.set('SYNTHETIC-PRIVATE',{sku:'SYNTHETIC-PRIVATE'});
      safetyDaysBySku.set('SYNTHETIC-PRIVATE',{sku:'SYNTHETIC-PRIVATE'});
      safetyRuleSets.push({id:'SYNTHETIC-PRIVATE'});
      bomCatalog.push({sku:'SYNTHETIC-PRIVATE'});
      bomChangeHistory.push({id:'SYNTHETIC-PRIVATE'});
    },
  };`))(...Object.values(bindings));
  return {...api,dispose:()=>cleanups.forEach(stop=>stop())};
}
const pageBodies=(label,entity)=>({records:[{key:label,payload:entity==='forecast'?[{sku:label,month:'2026-10'}]:{id:label,login:label,code:label,name:label,week,rows:[],items:[],active:true,permissions:label}}]});
const entityOf=input=>new URL(input,'https://synthetic.test').searchParams.get('entity');

// Stable caching differs by loader: administrative reads deliberately revalidate
// on each call, while planning/catalog reads retain successful values.
const pageLoaders=[
  ['loadInventoryImports','inventoryImportsCache',true],
  ['loadInventorySnapshots','inventorySnapshotsCache',true],
  ['loadForecastRecords','forecastRecordsCache',true],
  ['loadProductionEngineRecords','productionEngineRecordsCache',true],
  ['loadSystemUsers','systemUsersCache',false],
  ['loadDepartments','departmentRecordsCache',true],
  ['loadPermissionRecords','permissionRecordsCache',false],
];

test('page session reset synchronously clears every retained display value and pending loader; mutation does not',()=>{
  const h=pageHarness();try{
    const value={marker:'SYNTHETIC-ACCOUNT-A'};h.seedRetained(value);
    sync.clearClientReads('mutation');assert.ok(Object.values(h.snapshot()).every(item=>item===value));
    sync.clearClientReads();assert.ok(Object.values(h.snapshot()).every(item=>item===null));
  }finally{h.dispose();}
});


test('page session reset removes account-derived Leadtime, Safety and BOM values while retaining packaged baselines',()=>{
  const h=pageHarness();try{
    const baseline=h.derivedSnapshot();h.seedDerived();const changed=h.derivedSnapshot();
    assert.notDeepEqual(changed,baseline);
    sync.clearClientReads('mutation');assert.deepEqual(h.derivedSnapshot(),changed);
    sync.clearClientReads();assert.deepEqual(h.derivedSnapshot(),baseline);
  }finally{h.dispose();}
});

for(const [loader,cacheName,reusesSuccess] of pageLoaders){
  test(`page ${loader}: old late JSON cannot poison a new session or clear its pending read`,async()=>{
    const h=pageHarness(),old=new Map(),current=new Map();let account='old';
    globalThis.fetch=async input=>{
      const entity=entityOf(input),responses=account==='old'?old:current;
      if(!responses.has(entity))responses.set(entity,delayedJson(pageBodies(account==='old'?'SYNTHETIC-OLD':'SYNTHETIC-CURRENT',entity)));
      return responses.get(entity).response;
    };
    try{
      const before=h[loader](),rejected=cancelled(before);await tick();assert.ok(old.size);
      await Promise.all([...old.values()].map(response=>response.started));
      sync.clearClientReads();account='new';const fresh=h[loader]();await tick();
      await Promise.all([...current.values()].map(response=>response.started));
      for(const response of old.values())response.finish();await rejected;
      assert.equal(h.snapshot()[cacheName],null,'cancelled results are never converted into a successful fallback');
      const joined=h[loader]();await tick();
      for(const response of current.values())assert.equal(response.decodes,1,'old finally must leave the newer retained promise intact');
      for(const response of current.values())response.finish();
      const [freshValue,joinedValue]=await Promise.all([fresh,joined]);assert.deepEqual(freshValue,joinedValue);
      assert.match(JSON.stringify(h.snapshot()[cacheName]),/SYNTHETIC-CURRENT/);
      assert.doesNotMatch(JSON.stringify(h.snapshot()[cacheName]),/SYNTHETIC-OLD/);
      const saved=h.snapshot()[cacheName];sync.clearClientReads('mutation');assert.equal(h.snapshot()[cacheName],saved);
      if(reusesSuccess)assert.equal(await h[loader](),saved);
      sync.clearClientReads();assert.equal(h.snapshot()[cacheName],null);
    }finally{h.dispose();}
  });

  test(`page ${loader}: SSR neither reuses browser state nor retains successful responses`,async()=>{
    const h=pageHarness();try{
      globalThis.fetch=async input=>Response.json(pageBodies('SYNTHETIC-BROWSER',entityOf(input)));
      await h[loader]();const saved=h.snapshot()[cacheName];assert.ok(saved);
      delete globalThis.window;let calls=0;
      globalThis.fetch=async input=>{calls++;return Response.json(pageBodies('SYNTHETIC-SSR',entityOf(input)));};
      const first=await h[loader](),firstCalls=calls,second=await h[loader]();
      assert.ok(firstCalls>0);assert.equal(calls,firstCalls*2);assert.deepEqual(first,second);
      assert.match(JSON.stringify(first),/SYNTHETIC-SSR/);assert.doesNotMatch(JSON.stringify(first),/SYNTHETIC-BROWSER/);
      assert.equal(h.snapshot()[cacheName],saved,'server responses never replace browser-only retained state');
    }finally{h.dispose();}
  });
}

test('planning display updates reject a previous session ticket and never retain data during SSR',()=>{
  const h=pageHarness();try{
    const oldSession=sync.clientSessionGeneration();h.updatePlanningSessionCacheForSession({baseMonth:'SYNTHETIC-A'},oldSession);
    assert.equal(h.snapshot().planningSessionCache.baseMonth,'SYNTHETIC-A');
    sync.clearClientReads();h.updatePlanningSessionCacheForSession({baseMonth:'SYNTHETIC-LATE-A'},oldSession);
    assert.equal(h.snapshot().planningSessionCache,null);
    h.updatePlanningSessionCacheForSession({baseMonth:'SYNTHETIC-B'},sync.clientSessionGeneration());
    assert.equal(h.snapshot().planningSessionCache.baseMonth,'SYNTHETIC-B');
    delete globalThis.window;h.updatePlanningSessionCacheForSession({baseMonth:'SYNTHETIC-SSR'},sync.clientSessionGeneration());
    assert.equal(h.snapshot().planningSessionCache.baseMonth,'SYNTHETIC-B');
  }finally{h.dispose();}
});

function identityReceiver(h,initial){
  const home=declarations.get('Home');let callback;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(pageAst)==='receiveIdentity')callback=node.initializer.arguments[0].getText(pageAst);ts.forEachChild(node,visit);}
  visit(home);assert.ok(callback);
  const state={identity:initial,workspaces:{tabs:[{id:'synthetic-sensitive-tab'}],active:'synthetic-sensitive-tab'},epoch:0,authorizationChanged:false,feedbackClears:0};
  const identityRef={current:initial};
  const bindings={identityRef,workspaceIdentityKey:h.workspaceIdentityKey,clearProductionSnapshot:()=>{},clearActionFeedback:()=>{state.feedbackClears++;},clearClientReads:sync.clearClientReads,workspaceHome:{view:'sku'},
    setActiveViewers:()=>{},setNotificationGroups:()=>{},setNotificationCount:()=>{},
    setWorkspaces:value=>{state.workspaces=typeof value==='function'?value(state.workspaces):value;},
    setHomeEpoch:value=>{state.epoch=typeof value==='function'?value(state.epoch):value;},
    setAuthorizationChanged:value=>{state.authorizationChanged=value;},
    setIdentity:value=>{state.identity=typeof value==='function'?value(state.identity):value;},
  };
  return {state,receive:new Function(...Object.keys(bindings),transpile(`return ${callback};`))(...Object.values(bindings))};
}
const identity=(login,overrides={})=>({language:'vi',authenticated:true,session:{kind:'account',login,name:login,role:'USER',isAdmin:false,grants:['Planning/read','SKU/read'],...overrides}});

test('actual Home identity callback resets account changes and same-login grant/role scope changes',()=>{
  const h=pageHarness();try{
    for(const next of [identity('bob'),identity('alice',{grants:['SKU/read']}),identity('alice',{isAdmin:true}),identity('alice',{role:'ADMIN'}),{language:'vi',authenticated:false,session:null}]){
      const initial=identity('alice'),receiver=identityReceiver(h,initial),generation=sync.clientSessionGeneration();
      h.seedRetained({marker:'SYNTHETIC-ALICE'});receiver.receive(next);
      assert.equal(sync.clientSessionGeneration(),generation+1);
      assert.ok(Object.values(h.snapshot()).every(value=>value===null));
      assert.equal(receiver.state.epoch,1);assert.equal(receiver.state.feedbackClears,1);assert.deepEqual(receiver.state.workspaces.tabs,[]);
    }
  }finally{h.dispose();}
});

test('actual Home identity callback preserves cache for language, display name and reordered unchanged grants',()=>{
  const h=pageHarness();try{
    const initial=identity('alice'),receiver=identityReceiver(h,initial),generation=sync.clientSessionGeneration();
    const saved={marker:'SYNTHETIC-ALICE'};h.seedRetained(saved);
    receiver.receive({...identity('alice',{name:'New display name',grants:['SKU/read','Planning/read']}),language:'en'});
    assert.equal(sync.clientSessionGeneration(),generation);assert.equal(receiver.state.epoch,0);assert.equal(receiver.state.feedbackClears,0);
    assert.ok(Object.values(h.snapshot()).every(value=>value===saved));
  }finally{h.dispose();}
});
