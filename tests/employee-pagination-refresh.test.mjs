import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {paginationMutation} from '../lib/table-pagination.mjs';
import {paginationModel,paginationPages,paginationLabels,paginationSummary,isPaginationPlaceholder} from '../lib/pagination-presentation.mjs';

// Execute the production pagination effect rather than a copied pagination algorithm.
// The small DOM below models its operations, not browser layout or scroll anchoring.
const source=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='AutoTablePagination');
assert.ok(component,'AutoTablePagination must exist');
const effects=component.body.statements.filter(ts.isExpressionStatement)
 .map(node=>node.expression).filter(node=>ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect');
const effect=effects.find(node=>node.arguments[0]?.getText(ast).includes('paginationMutation(record)'));
assert.ok(effect,'Extract the real row-pagination effect');
const compiled=ts.transpileModule(`module.exports=${effect.arguments[0].getText(ast)};`,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;

class Element {
 constructor(tag='div',className=''){
  this.tag=tag;this.className=className;this.nodeType=1;this.children=[];this.dataset={};
  this.attributes={};this.parentElement=null;this.textContent='';this.hidden=false;
  this.scrollTop=0;this.scrollCalls=[];
  this.classList={
   contains:name=>this.className.split(/\s+/).includes(name),
   add:name=>{if(!this.classList.contains(name))this.className+=` ${name}`;},
   remove:name=>{this.className=this.className.split(/\s+/).filter(value=>value!==name).join(' ');},
  };
 }
 get previousElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)-1]||null;}
 get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]||null;}
 get lastElementChild(){return this.children.at(-1)||null;}
 get rows(){return this.children;}
 append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
 remove(){if(this.parentElement){const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;}}
 insertAdjacentElement(position,element){assert.equal(position,'afterend');const parent=this.parentElement;element.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,element);}
 setAttribute(name,value){if(name.startsWith('data-'))this.dataset[name.slice(5)]=String(value);else this.attributes[name]=String(value);}
 getAttribute(name){return name.startsWith('data-')?this.dataset[name.slice(5)]??null:this.attributes[name]??null;}
 closest(selector){
  for(let node=this;node;node=node.parentElement){
   if(selector==='.table-wrap > table'){if(node.tag==='table'&&node.parentElement?.classList.contains('table-wrap'))return node;}
   else if(selector.startsWith('.')){if(node.classList.contains(selector.slice(1)))return node;}
   else throw Error(`Unsupported closest selector: ${selector}`);
  }
  return null;
 }
 scrollTo(options){this.scrollCalls.push({...options});this.scrollTop=options.top;}
}

function fixture(t,count=35){
 const root=new Element(),card=new Element(),wrap=new Element('div','table-wrap');
 const table=new Element('table'),body=new Element('tbody'),toolbar=new Element('nav');
 root.append(toolbar,card);card.append(wrap);wrap.append(table);table.append(body);table.tBodies=[body];
 const employeeRow=index=>{const row=new Element('tr');row.textContent=`TEST-EMP-${index} Synthetic employee ${index} Line A Active 1`;return row;};
 body.append(...Array.from({length:count},(_,index)=>employeeRow(index+1)));
 root.querySelectorAll=selector=>{
  if(selector==='.app-shell .table-wrap > table')return [table];
  if(selector==='.table-pagination')return card.children.filter(node=>node.classList.contains('table-pagination'));
  throw Error(`Unsupported root selector: ${selector}`);
 };
 const frames=new Map(),notifications=[];let frameId=0,observer;
 const context={module:{exports:{}},scopeId:'employee-test',Element,
  actionFeedbackStyles:{explanation:'feedback-explanation'},notifyActionFailure:(message,trigger)=>notifications.push({message,trigger}),
  document:{getElementById:id=>id==='employee-test'?root:null,createElement:tag=>new Element(tag)},
  requestAnimationFrame:callback=>{const id=++frameId;frames.set(id,callback);return id;},
  cancelAnimationFrame:id=>frames.delete(id),
  MutationObserver:class {
   constructor(callback){this.callback=callback;observer=this;}
   observe(target,options){assert.equal(target,root);assert.equal(options.childList,true);assert.equal(options.subtree,true);}
   disconnect(){this.callback=null;}
  },
  subscribeToolbarLocale:()=>()=>{},toolbarLocale:()=> 'en',
  paginationMutation,paginationModel,paginationPages,paginationLabels,paginationSummary,isPaginationPlaceholder,
 };
 const flush=()=>{for(const [id,callback] of [...frames]){frames.delete(id);callback();}};
 vm.runInNewContext(compiled,context);const cleanup=context.module.exports();t.after(cleanup);flush();
 const pager=()=>wrap.nextElementSibling;
 const click=label=>{const button=pager().children[1].children.find(node=>node.textContent===label);assert.ok(button,`Pager button ${label}`);button.onclick();};
 return {table,body,wrap,toolbar,pager,click,notifications,
  notify(target=body){observer.callback([{target,addedNodes:[],removedNodes:[]}]);flush();},
  visible:()=>body.rows.filter(row=>!row.hidden).map(row=>row.textContent),
  page:()=>Number(pager().dataset.page),
  parkOnPageThree(){click('3');wrap.scrollTop=137;wrap.scrollCalls.length=0;},
 };
}

test('employee same-row refresh keeps page 3, row visibility, pager identity and scroll position',t=>{
 const h=fixture(t);h.parkOnPageThree();const pager=h.pager(),visible=h.visible();
 // Loading/toolbar changes are unrelated; an unchanged row signature is also a no-op.
 h.notify(h.toolbar);h.notify();h.notify();
 assert.equal(h.pager(),pager);assert.equal(h.page(),3);assert.deepEqual(h.visible(),visible);
 assert.match(h.visible()[0],/^TEST-EMP-21 /);assert.equal(h.visible().length,10);
 assert.equal(h.wrap.scrollTop,137);assert.equal(h.wrap.scrollCalls.length,0);
});

test('employee changed-row refresh keeps page 3 and updates its visible records without scrolling',t=>{
 const h=fixture(t);h.parkOnPageThree();const previousPager=h.pager();
 h.body.rows[24].textContent='TEST-EMP-25 Updated employee Line B Active 2';h.notify();
 assert.notEqual(h.pager(),previousPager);assert.equal(h.page(),3);
 assert.equal(h.visible().length,10);assert.match(h.visible()[4],/Updated employee/);
 assert.equal(h.wrap.scrollTop,137);assert.equal(h.wrap.scrollCalls.length,0);
});

test('employee rows shrinking clamp the prior page to the last page without scrollTo',t=>{
 const h=fixture(t);h.parkOnPageThree();
 h.body.replaceChildren(...h.body.rows.slice(0,15));h.notify();
 assert.equal(h.page(),2);assert.equal(h.visible().length,5);assert.match(h.visible()[0],/^TEST-EMP-11 /);
 assert.equal(h.wrap.scrollCalls.length,0);
 h.body.replaceChildren();h.notify();assert.equal(h.page(),1);assert.deepEqual(h.visible(),[]);
 assert.equal(h.wrap.scrollCalls.length,0);
});

test('only explicit pagination changes scroll the employee table to the top',t=>{
 const h=fixture(t);h.parkOnPageThree();
 h.click('3');assert.equal(h.wrap.scrollTop,137);assert.equal(h.wrap.scrollCalls.length,0);
 h.click('2');assert.equal(h.page(),2);assert.equal(h.wrap.scrollTop,0);
 assert.deepEqual(h.wrap.scrollCalls,[{top:0,behavior:'instant'}]);
 assert.match(h.visible()[0],/^TEST-EMP-11 /);
});

// Exercise the real imperative pagination explanation, including keyboard input.
test('disabled pagination explains without changing rows or scrolling',t=>{
 const h=fixture(t);const before=h.visible();
 const explanation=h.pager().children[1].children[0];
 assert.equal(explanation.getAttribute('role'),'button');
 assert.equal(explanation.children[0].disabled,true);
 assert.equal(h.notifications.length,0);
 for(const key of [null,'Enter',' ']){
  let prevented=0,stopped=0;const event={key,preventDefault(){prevented++;},stopPropagation(){stopped++;}};
  if(key)explanation.onkeydown(event);else explanation.onclick(event);
  assert.equal(prevented,1);assert.equal(stopped,1);
 }
 assert.equal(h.notifications.length,3);assert.ok(h.notifications.every(n=>n.message==='You are on the first page.'&&n.trigger===explanation));
 assert.equal(h.page(),1);assert.deepEqual(h.visible(),before);assert.equal(h.wrap.scrollCalls.length,0);
 h.click('1');assert.equal(h.notifications.at(-1).message,'You are already on this page.');assert.equal(h.wrap.scrollCalls.length,0);
});
