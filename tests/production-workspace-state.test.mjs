import test from 'node:test';
import assert from 'node:assert/strict';
import {openWorkspace} from '../lib/workspace-tabs.mjs';
import {savedProductionWorkspace,restoreProductionWorkspace} from '../lib/production-workspace-state.mjs';
const blank=()=>({overviewRoute:{view:'sku',child:null,planTab:'base'},tabs:[],active:null,nextId:1});
test('reopening restores production menus and the last active route, excluding drafts and unrelated menus',()=>{
 let state=blank();
 for(const child of ['report-dashboard','report-work'])state=openWorkspace(state,{view:'production',child,planTab:'base',focusSku:'UNSAVED-INTENT'});
 const saved=savedProductionWorkspace(state);
 assert.equal(JSON.stringify(saved).includes('UNSAVED'),false);
 const restored=restoreProductionWorkspace(blank(),saved,()=>true);
 assert.deepEqual(restored.tabs.map(t=>t.route.child),['report-dashboard','report-work']);
 assert.equal(restored.tabs.find(t=>t.id===restored.active).route.child,'report-work');
 assert.ok(restored.tabs.every(t=>t.intent===null));
 const narrowed=restoreProductionWorkspace(blank(),saved,child=>child==='report-dashboard');
 assert.equal(narrowed.tabs.length,1);assert.equal(narrowed.active,null);
 const userNavigated=openWorkspace(blank(),{view:'production',child:'report-progress',planTab:'base'});
 assert.equal(restoreProductionWorkspace(userNavigated,saved,()=>true),userNavigated);
});
test('closed menus stay closed and only authorized production routes can be restored',()=>{
 assert.deepEqual(savedProductionWorkspace(blank()).routes,[]);
 const restored=restoreProductionWorkspace(blank(),{routes:[{view:'users',child:'users-list'},{view:'production',child:'report-work'}],active:'production:report-work:'},()=>false);
 assert.deepEqual(restored.tabs,[]);
});
