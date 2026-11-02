import test from 'node:test';
import assert from 'node:assert/strict';
import {openWorkspace,closeWorkspace,workspaceRouteKey} from '../lib/workspace-tabs.mjs';
const blank=()=>({tabs:[],active:null,nextId:1});
const sku={view:'sku',child:'sku-master',planTab:'base'};
const inventory={view:'warehouse',child:'inventory',planTab:'base'};
test('open menus once and reuse the mounted instance with its UI state on return',()=>{
 let state=openWorkspace(blank(),sku);
 const first=state.tabs[0];
 const mountedStates=new Map([[first.id,{filter:'inox',page:3,draft:'chưa lưu',detail:'102XS02001'}]]);
 state=openWorkspace(state,inventory);
 state=openWorkspace(state,sku);
 assert.equal(state.tabs.length,2);assert.equal(state.active,first.id);
 assert.equal(state.tabs[0],first);
 assert.deepEqual(mountedStates.get(state.active),{filter:'inox',page:3,draft:'chưa lưu',detail:'102XS02001'});
});
test('separate report menus have separate mounted filter/preview workspaces',()=>{
 const one={view:'planning',child:'report',planTab:'report',report:'weekly-plan'};
 const two={...one,report:'progress'};
 let state=openWorkspace(openWorkspace(blank(),one),two);
 assert.equal(state.tabs.length,2);
 state=openWorkspace(state,one);assert.equal(state.active,state.tabs[0].id);
});
test('close active selects adjacent tab; closing others does not change the active one',()=>{
 let state=openWorkspace(openWorkspace(openWorkspace(blank(),sku),inventory),{view:'production',child:'report-progress',planTab:'base'});
 const [a,b,c]=state.tabs;
 state=closeWorkspace(state,b.id);assert.equal(state.active,c.id);
 state=closeWorkspace(state,c.id);assert.equal(state.active,a.id);
 state=closeWorkspace(state,a.id);assert.deepEqual(state.tabs,[]);assert.equal(state.active,null);
 assert.equal(closeWorkspace(state,'missing'),state);
});
test('closing then reopening creates a fresh instance, without deleting other tabs or business records',()=>{
 let state=openWorkspace(openWorkspace(blank(),sku),inventory);
 const old=state.tabs[0].id;const kept=state.tabs[1];
 state=openWorkspace(closeWorkspace(state,old),sku);
 assert.notEqual(state.active,old);assert.equal(state.tabs[0],kept);
});
test('explicit cross-menu SKU links update target intent but normal switching preserves it',()=>{
 let state=openWorkspace(blank(),inventory);const id=state.active;
 state=openWorkspace(state,{...inventory,focusSku:'SKU-A'});
 const first=state.tabs[0].intent;
 assert.equal(state.active,id);assert.equal(state.tabs.length,1);assert.equal(first.sku,'SKU-A');
 state=openWorkspace(state,inventory);assert.equal(state.tabs[0].intent,first);
 state=openWorkspace(state,{...inventory,focusSku:'SKU-A'});assert.ok(state.tabs[0].intent.sequence>first.sequence);
});
test('production menu aliases reuse SX báo công; unrelated views stay separate',()=>{
 assert.equal(workspaceRouteKey({view:'production',child:'production-report'}),workspaceRouteKey({view:'production',child:'report-work'}));
 assert.notEqual(workspaceRouteKey({view:'sku',child:null}),workspaceRouteKey({view:'warehouse',child:null}));
});

test('parent menus select the overview without adding, closing or resetting child tabs',()=>{
 let state=openWorkspace(openWorkspace(blank(),sku),inventory);
 const children=state.tabs;
 const nextId=state.nextId;
 const parent={view:'bom',child:null,planTab:'base'};
 state=openWorkspace(state,parent);
 assert.equal(state.active,null);assert.equal(state.tabs,children);
 assert.equal(state.nextId,nextId);assert.equal(state.overviewRoute,parent);
 state=openWorkspace(state,sku);
 assert.equal(state.active,children[0].id);assert.equal(state.tabs,children);
});
test('switching several parent menus keeps only the latest overview and creates no tabs',()=>{
 let state=blank();
 for(const view of ['sku','warehouse','bom','planning','production','users'])state=openWorkspace(state,{view,child:null,planTab:'base'});
 assert.deepEqual(state.tabs,[]);assert.equal(state.nextId,1);assert.equal(state.active,null);
 assert.equal(state.overviewRoute.view,'users');
});

test('nested Capacity, order tracking and Report groups never create a tab; actual children keep their mounted state',()=>{
 let state=openWorkspace(blank(),sku);const original=state.tabs[0];
 for(const route of [{view:'production',child:'weekly-capacity'},{view:'production',child:'production-report'},{view:'planning',child:'report',planTab:'report'}]){
  state=openWorkspace(state,route);assert.equal(state.tabs.length,1);assert.equal(state.tabs[0],original);assert.equal(state.active,null);assert.equal(state.overviewRoute,route);
 }
 for(const route of [{view:'production',child:'capacity-calendar'},{view:'production',child:'capacity-summary'},{view:'planning',child:'report',report:'weekly-plan'}])state=openWorkspace(state,route);
 assert.equal(state.tabs.length,4);const calendar=state.tabs[1];state=openWorkspace(state,{view:'production',child:'capacity-calendar'});assert.equal(state.active,calendar.id);assert.equal(state.tabs[1],calendar);
});

test('notification carries approval intent into new and existing destination tabs',()=>{
 let state=openWorkspace(blank(),sku);
 const first=state.tabs[0].id;
 state=openWorkspace(state,inventory);
 state=openWorkspace(state,{...sku,approvalEntity:'sku'});
 assert.equal(state.active,first);assert.equal(state.tabs.length,2);
 assert.equal(state.tabs[0].intent.approval,'sku');
 const sequence=state.tabs[0].intent.sequence;
 state=openWorkspace(state,{...sku,approvalEntity:'sku'});
 assert.ok(state.tabs[0].intent.sequence>sequence);
 state=openWorkspace(state,{view:'bom',child:'bom-change',approvalEntity:'bom_change'});
 assert.equal(state.tabs.at(-1).intent.approval,'bom_change');
});
