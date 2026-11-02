import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,server:{middlewareMode:true}});
after(()=>vite.close());
const {WebsiteTestLogDetails}=await vite.ssrLoadModule('/components/website-test-log-details.tsx');
test('actual detail component renders readable localized field table without JSON',()=>{
 for(const [language,label] of [['vi','Trường dữ liệu'],['en','Field'],['zh','欄位']]){
 const html=renderToStaticMarkup(React.createElement(WebsiteTestLogDetails,{language,entry:{hasBefore:true,hasAfter:true,before:{name:'An',line:'A'},after:{name:'Anh',line:'B'},summary:{request:{reviewReason:'<script>not HTML</script>'}}}}));
 assert.ok(html.includes(label));assert.match(html,/<table/);assert.match(html,/Anh/);assert.doesNotMatch(html,/<pre|\{&quot;|<script>/);assert.match(html,/&lt;script&gt;/);
 }
});
test('missing snapshot is explicitly disclosed and literal zero remains visible',()=>{
 const html=renderToStaticMarkup(React.createElement(WebsiteTestLogDetails,{entry:{hasBefore:false,hasAfter:true,after:{qty:0}}}));assert.match(html,/Không rõ/);assert.match(html,/lịch sử|Lịch sử/);assert.match(html,/>0<\/span>/);
});
test('an abbreviated snapshot never claims there were no changes',()=>{
 const before=Object.fromEntries(Array.from({length:151},(_,i)=>['k'+i,0])),after={...before,k150:1};
 const html=renderToStaticMarkup(React.createElement(WebsiteTestLogDetails,{entry:{before,after,hasBefore:true,hasAfter:true}}));
 assert.match(html,/Không thấy khác biệt trong phần dữ liệu hiển thị/);assert.match(html,/có thể đã rút gọn/);assert.doesNotMatch(html,/Không có khác biệt trong các trường đã lưu/);
});
