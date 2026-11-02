import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {clientAuthorizationKey} from '../lib/client-authorization-context.mjs';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const home=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Home');
let callback;for(const statement of home.body.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.name.getText(ast)==='receiveIdentity')callback=declaration.initializer.arguments[0].getText(ast);
assert.ok(callback,'exercise the actual Home callback, not a copied implementation');
const account=(changes={})=>({language:'vi',authenticated:true,session:{kind:'account',login:'synthetic-a',name:'Original',role:'HR',grants:['SKU','Capacity'],...changes}});
function harness(initial=account()){
 const state={identity:initial,workspaces:{overviewRoute:{view:'production'},tabs:[{id:'draft-tab'}],active:'draft-tab',nextId:2},epoch:7,notice:false,clears:0,productionClears:0,feedbackClears:0,viewers:[1],groups:[1],count:1};
 const context={identityRef:{current:initial},workspaceIdentityKey:clientAuthorizationKey,workspaceHome:{view:'sku',child:null,planTab:'base'},clearProductionSnapshot:()=>state.productionClears++,clearActionFeedback:()=>state.feedbackClears++,clearClientReads:()=>state.clears++};
 for(const [name,key] of [['setIdentity','identity'],['setWorkspaces','workspaces'],['setHomeEpoch','epoch'],['setAuthorizationChanged','notice'],['setActiveViewers','viewers'],['setNotificationGroups','groups'],['setNotificationCount','count']])context[name]=value=>state[key]=typeof value==='function'?value(state[key]):value;
 vm.runInNewContext(ts.transpileModule(`const receiveIdentity=${callback};globalThis.receiveIdentity=receiveIdentity;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 return {state,receive:context.receiveIdentity};
}
test('real Home identity refresh preserves mounted draft identity for names, language and reordered equivalent grants',()=>{
 const {state,receive}=harness(),workspaces=state.workspaces;
 receive({...account({name:'Renamed',grants:['Capacity','SKU','SKU']}),language:'en'});
 assert.equal(state.workspaces,workspaces);assert.equal(state.epoch,7);assert.equal(state.clears,0);assert.equal(state.productionClears,0);assert.equal(state.feedbackClears,0);assert.equal(state.notice,false);assert.equal(state.identity.session.name,'Renamed');
});
test('real Home effective grant/role change resets old views and announces unsaved prior-scope state removal',()=>{
 for(const change of [{grants:['SKU']},{role:'KHSX'},{isAdmin:true}]){
  const {state,receive}=harness();receive(account(change));assert.equal(state.clears,1);assert.equal(state.productionClears,1);assert.equal(state.feedbackClears,1);assert.equal(state.workspaces.tabs.length,0);assert.equal(state.epoch,8);assert.equal(state.notice,true);assert.equal(state.count,0);assert.equal(state.groups.length,0);assert.equal(state.viewers.length,0);
 }
 assert.match(source,/Quyền truy cập đã thay đổi\. Màn hình đã được làm mới/);
 assert.match(source,/Các thay đổi chưa lưu của phiên quyền trước không được giữ lại/);
});
test('real Home account swap/logout resets all views; initial login keeps intended landing route',()=>{
 for(const next of [account({login:'synthetic-b'}),{language:'vi',authenticated:false,session:null}]){
  const {state,receive}=harness();receive(next);assert.equal(state.clears,1);assert.equal(state.feedbackClears,1);assert.equal(state.epoch,8);assert.equal(state.workspaces.tabs.length,0);assert.equal(state.notice,false);
 }
 const {state,receive}=harness({language:'vi',authenticated:false,session:null}),workspaces=state.workspaces;
 receive(account());assert.equal(state.clears,1);assert.equal(state.feedbackClears,1);assert.equal(state.workspaces,workspaces);assert.equal(state.epoch,7);
});
