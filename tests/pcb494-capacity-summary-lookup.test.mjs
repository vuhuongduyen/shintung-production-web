import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
// Synthetic ready-state fixture bypasses only the initial async load gate; no API runs in SSR.
const vite=await createServer({plugins:[{name:'test-capacity-ready',enforce:'pre',transform(source,id){if(!id.endsWith('/components/weekly-capacity.tsx'))return;const before='[weekReady,setWeekReady]=useState(initial.ready)';assert.equal(source.split(before).length,2);return source.replace(before,'[weekReady,setWeekReady]=useState(true)').replace('[search,setSearch]=useState(false)','[search,setSearch]=useState(Boolean(globalThis.__capacityLookupFixture))');}}],configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {default:WeeklyCapacity}=await vite.ssrLoadModule('/components/weekly-capacity.tsx');
function render(view){return renderToStaticMarkup(React.createElement(WeeklyCapacity,{view,onNavigateSummary:()=>{throw Error('No navigation during render');}}));}
test('Summary omits lookup button and retains week and Line fields',()=>{
 const html=render('summary');assert.doesNotMatch(html,/>Tra cứu<|>TRA CỨU</);assert.match(html,/type="date"/);assert.match(html,/Tất cả/);assert.match(html,/<option value="A">A<\/option><option value="B">B<\/option>/);
});
test('Calendar keeps lookup but omits redundant parent Back',()=>{
 const html=render('calendar');assert.match(html,/>Tra cứu<|>TRA CỨU</);assert.doesNotMatch(html,/>Quay lại</);assert.match(html,/type="date"/);
});

test('Calendar lookup retains exactly one internal Back',()=>{
 globalThis.__capacityLookupFixture=true;try{const html=render('calendar');assert.equal((html.match(/>Quay lại</g)||[]).length,1);}finally{delete globalThis.__capacityLookupFixture;}
});
