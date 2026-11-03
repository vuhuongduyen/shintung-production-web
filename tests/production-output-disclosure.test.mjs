import {actionFeedbackComponentFixture} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {renderToStaticMarkup} from 'react-dom/server';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const source=read('../components/labor-deviation-disclosure.tsx');
function load(source,imports={}) {
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 const mod={exports:{}};new Function('module','exports','React','require',js)(mod,mod.exports,React,id=>imports[id]??require(id));return mod.exports;
}
const popoverSource=read('../components/ui/popover.tsx');
const popover=load(popoverSource,{'@/lib/utils':{cn:(...names)=>names.filter(Boolean).join(' ')}});
const mod={exports:load(source,{'./ui/popover':popover,'./action-feedback':actionFeedbackComponentFixture})};
const render=props=>renderToStaticMarkup(React.createElement(mod.exports.default,props));
const base={value:'+1.105,89%',warning:true,explanation:'Lệch hơn ±10%: kiểm tra lại giờ công chuẩn',label:'Kiểm tra giờ chuẩn · TEST-LSX'};
test('warning starts collapsed with accessible button and exact percentage',()=>{
 const html=render(base);
 assert.match(html,/<button[^>]*type="button"/);
 assert.match(html,/aria-haspopup="dialog"/);
 assert.match(html,/aria-expanded="false"/);
 assert.match(html,/aria-label="\+1\.105,89% · Kiểm tra giờ chuẩn · TEST-LSX"/);
 assert.match(html,/<span class="labor-deviation-value">\+1\.105,89%<\/span>/);
 assert.match(html,/<span class="labor-deviation-arrow" aria-hidden="true">▸<\/span>/);
 assert.doesNotMatch(html,/<details|<p>|role="dialog"/);
});
test('ordinary and unavailable values have no trigger or warning',()=>{
 for(const value of ['—','-5,68%','0%'])assert.equal(render({...base,value,warning:false}),`<span class="labor-deviation-value">${value}</span>`);
});
test('warning uses shared portaled popover with focus, dismissal and viewport handling',()=>{
 assert.match(popoverSource,/<PopoverPrimitive.Portal>/);
 assert.match(source,/<Popover open=\{open\} onOpenChange=\{setOpen\}/);
 assert.match(source,/collisionPadding=\{12\} hideWhenDetached/);
 assert.match(source,/aria-label=\{label\}/);
 assert.match(source,/aria-label=\{closeLabel\} onClick=\{\(\)=>setOpen\(false\)\}/);
 assert.match(source,/<p>\{explanation\}<\/p>/);
 // Preserve Radix default Escape/outside dismissal and keyboard focus return.
 assert.doesNotMatch(source,/preventDefault|onEscapeKeyDown|onInteractOutside|onCloseAutoFocus|onOpenAutoFocus|fetch\(/);
 const css=read('../app/planning-compact.css');
 assert.match(css,/\.labor-deviation-disclosure\{[^}]*display:flex;[^}]*min-width:0;max-width:100%/);
 assert.match(css,/\.labor-deviation-value\{[^}]*white-space:normal!important;overflow-wrap:anywhere!important/);
 assert.match(css,/\.labor-deviation-disclosure:focus-visible\{outline:2px/);
 assert.doesNotMatch(css,/labor-deviation-disclosure>p/);
 const popupCss=read('../app/production-management.css');
 assert.match(popupCss,/\.production-reason-popover\{[^}]*calc\(100vw - 24px\)[^}]*--radix-popover-content-available-height/);
});
test('output uses disclosure without changing its numeric expression or exported percentage',()=>{
 const output=read('../components/production-output.tsx');
 assert.ok(output.includes("<LaborDeviationDisclosure closeLabel={t('Đóng')} value={r.ratio===null?'—':(r.ratio>0?'+':'')+number(r.ratio*100)+'%'} warning={r.warning}"));
 assert.ok(output.includes("Number((r.ratio*100).toFixed(2))+'%'"));
 assert.ok(output.includes('...laborUnitDeviation(r.unit,s.unit)'));
 assert.doesNotMatch(output,/r.warning&&<div>/);
});
