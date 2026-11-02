import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let addButton;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='addButton')addButton=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);
assert.ok(addButton);
function harness({page=1,empty=false}={}){
 const notices=[],scrolls=[],renders=[];
 const element=()=>({children:[],attributes:{},append(child){this.children.push(child);},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}});
 const context={page,rows:empty?[]:[{}],locale:'vi',labels:{previous:'Trang trước',next:'Trang sau',page:'Trang'},document:{createElement:element},actionFeedbackStyles:{explanation:'explanation'},nav:element(),notifyActionFailure:(message)=>notices.push(message),render:()=>renders.push(true),wrap:{scrollTo:x=>scrolls.push(x)}};
 vm.runInNewContext(ts.transpileModule(`globalThis.addButton=${addButton}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {context,notices,renders,scrolls};
}
const event=()=>({preventDefault(){},stopPropagation(){}});
test('imperative disabled paginator keeps native disabled and explains mouse/keyboard without navigation',()=>{
 for(const scenario of [{label:'‹',page:1,reason:'đầu tiên'},{label:'›',page:3,reason:'cuối cùng'},{label:'1',page:1,empty:true,reason:'Chưa có dữ liệu'}]){
  const h=harness(scenario);h.context.addButton(scenario.label,scenario.page,false,true);
  const wrapper=h.context.nav.children[0],button=wrapper.children[0];
  assert.equal(button.disabled,true);assert.equal(button.tabIndex,-1);assert.equal(wrapper.tabIndex,0);assert.equal(wrapper.attributes.role,'button');
  wrapper.onclick(event());wrapper.onkeydown({...event(),key:'Enter'});wrapper.onkeydown({...event(),key:' '});
  assert.equal(h.notices.length,3);assert.ok(h.notices.every(x=>x.includes(scenario.reason)));assert.equal(h.renders.length,0);assert.equal(h.scrolls.length,0);
 }
});
test('active paginator navigates once and current page gives an explanation',()=>{
 const h=harness();h.context.addButton('2',2);h.context.nav.children[0].onclick();assert.equal(h.context.page,2);assert.equal(h.renders.length,1);assert.equal(h.scrolls.length,1);
 h.context.addButton('2',2,true);h.context.nav.children[1].onclick();assert.equal(h.renders.length,1);assert.match(h.notices[0],/đang ở trang này/);
});
test('inert-button explanations do not suppress delegated ancestor row clicks',()=>{
 function walk(node){
  if(ts.isJsxOpeningElement(node)&&node.tagName.getText(ast)==='FeedbackActionButton'){
   const attrs=node.attributes.properties;
   if(attrs.some(a=>a.name?.text==='disabled'&&!a.initializer)&&attrs.some(a=>a.name?.text==='disabledExplanation')){
    let parent=node.parent.parent;while(parent){if(ts.isJsxElement(parent))assert.equal(parent.openingElement.attributes.properties.some(a=>a.name?.text==='onClick'),false,'disabled placeholder must not block delegated row interaction');parent=parent.parent;}
   }
  }ts.forEachChild(node,walk);
 }walk(ast);
});

test('shell permission and logout failures use safe floating feedback while denial still returns',()=>{
 assert.doesNotMatch(source,/window\.alert\(/);
 assert.match(source,/if\(!canOpenMenu\(identityRef.current.session,route.view,route.child\|\|undefined\)\)\{notifyActionFailure\("Bạn không có quyền mở chức năng này. Vui lòng liên hệ quản trị viên."\);return;\}/);
 assert.match(source,/notifyActionFailure\("Chưa đăng xuất được. Vui lòng thử lại."\)/);
});
