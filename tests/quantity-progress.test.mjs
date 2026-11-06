import test,{after} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
const server=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});after(()=>server.close());
const {default:Progress}=await server.ssrLoadModule('/components/quantity-progress.tsx');
const render=props=>renderToStaticMarkup(React.createElement(Progress,props));
test('200 then 500 of 1000 moves the number to 20 and 50 percent without an editable slider',()=>{
 for(const [value,percent]of [[200,20],[500,50]]){const html=render({value,total:1000});assert.match(html,new RegExp(`left:${percent}%`));assert.match(html,new RegExp(`translateX\\(-${percent}%\\)`));assert.match(html,new RegExp(`aria-valuenow="${value}"`));assert.doesNotMatch(html,/role="slider"|<input|tabindex/);}
});
test('unknown/zero total never divides by zero; excess legacy quantity stays readable and positioning is bounded',()=>{
 const missing=render({value:500,total:0});assert.doesNotMatch(missing,/NaN|Infinity|aria-valuenow/);const over=render({value:1200,total:1000});assert.match(over,/left:100%/);assert.match(over,/1\.200/);assert.match(over,/aria-valuenow="1000"/);
});
test('pending output stays explicitly distinct from confirmed output for warehouse reconciliation',()=>{
 const html=render({value:500,total:1000,approved:200,pending:300});assert.match(html,/Đã duyệt 200 · Chờ 300/);assert.match(html,/Đã xác nhận 200/);assert.match(html,/Chờ xác nhận 300/);
});
