import assert from 'node:assert/strict';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('built Worker renders Site login without the local TEST environment',async()=>{
 const base=fileURLToPath(new URL('../dist/server/',import.meta.url));
 const entry=resolve(base,'index.js');
 const paths=readdirSync(base,{recursive:true}).filter(name=>name.endsWith('.js')).map(name=>resolve(base,name));
 const runtime=new Miniflare({modules:[entry,...paths.filter(path=>path!==entry)].map(path=>({type:'ESModule',path})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false});
 try{const response=await runtime.dispatchFetch('http://localhost/');assert.equal(response.status,200);const html=await response.text();assert.doesNotMatch(html,/MÔI TRƯỜNG TEST/);assert.match(html,/ONSPA/);assert.match(html,/Tài khoản hoặc email/);assert.match(html,/Đăng nhập người dùng/);assert.match(html,/Đăng nhập Admin/);assert.match(html,/Hiện mật khẩu/);assert.match(html,/logo-onspa.jpg/);assert.doesNotMatch(html,/Đăng nhập bằng ChatGPT/);assert.doesNotMatch(html,/Đăng nhập TEST/);assert.doesNotMatch(html,/appgprj_|D1 binding|R2 binding/);}finally{await runtime.dispose();}
});
