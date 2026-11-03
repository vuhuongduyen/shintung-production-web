import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import ts from 'typescript';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const css=postcss.parse(read('app/ui-consistency.css'));
test('only a physically nested workspace receives the zero sidebar offset exception',()=>{
 const zero=[];css.walkRules(rule=>{if(rule.nodes.some(n=>n.type==='decl'&&n.prop==='margin-left'&&n.value==='0'&&n.important))zero.push(rule.selector)});
 assert.deepEqual(zero,['html body div.app-shell main.workspace main.workspace']);
 assert.ok(!zero.some(selector=>selector.includes('bom-change-embedded')));
 let top;css.walkRules(rule=>{if(rule.selectors?.includes('html body div.app-shell main.workspace'))top=rule});assert.ok(top);
 assert.ok(top.nodes.some(n=>n.prop==='margin-left'&&n.value==='var(--onspa-sidebar-width)'&&n.important));
 assert.ok(top.nodes.some(n=>n.prop==='width'&&n.value==='calc(100% - var(--onspa-sidebar-width))'&&n.important));
});
test('embedded BOM editor is a direct workspace return, not nested inside the former BOM main',()=>{
 const ast=ts.createSourceFile('page.tsx',read('app/page.tsx'),99,true,4);let lookup;ast.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='BomLookupView')lookup=n});assert.ok(lookup);
 let found=false;function walk(n){if(ts.isReturnStatement(n)&&n.expression){let value=n.expression;while(ts.isParenthesizedExpression(value))value=value.expression;if(ts.isJsxSelfClosingElement(value)&&value.tagName.getText(ast)==='BomChangeContent'){found=true;assert.ok(value.attributes.properties.some(p=>p.name?.getText(ast)==='embedded'));}}ts.forEachChild(n,walk)}walk(lookup);assert.ok(found);
});
test('embedded Back parent callback still returns local BOM state without workspace navigation or writes',()=>{
 const ast=ts.createSourceFile('page.tsx',read('app/page.tsx'),99,true,4);let callback;
 function walk(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='BomChangeContent'){const attr=n.attributes.properties.find(p=>p.name?.getText(ast)==='onClose');if(attr?.initializer&&ts.isJsxExpression(attr.initializer))callback=attr.initializer.expression.getText(ast);}ts.forEachChild(n,walk)}walk(ast);assert.ok(callback);
 assert.doesNotMatch(callback,/onNavigate|setActiveChild|fetch|setWorkspaces/);
 const js=ts.transpileModule('const callback='+callback,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.CommonJS}}).outputText;
 const calls=[];const fn=new Function('setMode','setSelected','setPendingChangeSkus','selected',js+';return callback;')(v=>calls.push(['mode',v]),v=>calls.push(['selected',v]),()=>calls.push(['pending']),{sku:'TEST-SKU'});
 fn();assert.deepEqual(calls,[['mode','view'],['selected',null]]);
});
