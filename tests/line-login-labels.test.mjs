import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fragment;
function visit(node){
  if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(p=>p.name?.getText(ast)==='className'&&p.initializer?.text==='quick-line-login'))fragment=node.getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
assert.ok(fragment,'test the actual login card JSX');
const js=ts.transpileModule(`globalThis.render=()=>(${fragment});`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function harness({busy=false,availableLines=['A','B']}={}){
 const calls=[];// The shared button interaction is covered separately; retain this label/prop fixture.
 const FeedbackActionButton=({disabledExplanation,allowed,deniedExplanation,...props})=>React.createElement('button',props);
 const context={React,FeedbackActionButton,busy,availableLines,loginLine:line=>calls.push(line)};
 vm.runInNewContext(js,context);
 const element=context.render();
 return {html:renderToStaticMarkup(element),buttons:element.props.children[1].props.children,calls};
}

test('line buttons render one exact label each without old subtitles',()=>{
 const {html,buttons}=harness();
 for(const line of ['A','B'])assert.equal(html.split(`Đăng nhập line ${line}`).length-1,1);
 assert.doesNotMatch(html,/Vào Line|Chỉ báo công|<small/);
 assert.match(html,/ĐĂNG NHẬP LINE · KHÔNG CẦN ID VÀ MẬT KHẨU/);
 for(const button of buttons)assert.equal(button.props.children[0].props['aria-hidden'],'true');
});

test('label-only changes retain line actions and busy/unavailable gating',()=>{
 const active=harness();
 active.buttons.forEach(button=>{assert.equal(button.props.disabled,false);button.props.onClick();});
 assert.deepEqual(active.calls,['A','B']);
 assert.ok(harness({busy:true}).buttons.every(button=>button.props.disabled));
 const unavailable=harness({availableLines:['A']});
 assert.equal(unavailable.buttons[0].props.disabled,false);
 assert.equal(unavailable.buttons[1].props.disabled,true);
 assert.equal(unavailable.buttons[1].props.title,'User Line chưa hoạt động');
 assert.match(unavailable.html,/>Đăng nhập line B</);
});

test('single label centers vertically and can wrap without clipping at narrow widths',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 const label=css.match(/\.quick-line-login button em\s*\{([^}]+)\}/)[1];
 assert.match(label,/white-space:\s*normal/);assert.match(label,/align-self:\s*center/);
 assert.match(css,/\.quick-line-login button\s*\{[^}]*grid-template-rows:\s*auto;/);
});
