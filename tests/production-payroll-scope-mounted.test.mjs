import {attachLaborReferences} from '../lib/production-labor-reference.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {trackBrowserChannels} from './helpers/browser-channels.mjs';
const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createTestServer} from './helpers/vite-test-server.mjs';
import {scopedPayrollFixture,fullPayrollFixture,month} from './helpers/payroll-scope-fixture.mjs';
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic-payroll.invalid'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','CustomEvent','Node','localStorage','sessionStorage'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.sessionStorage.setItem('onspa-payroll-month',month);
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createTestServer(),{default:Screen}=await vite.ssrLoadModule('/components/production-payroll.tsx');
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{assert.equal(String(url),'/api/production-standards');return Response.json({records:['A','B'].map(line=>({key:'SYNTHETIC-SKU-'+line,payload:{sku:'SYNTHETIC-SKU-'+line,laborHour:1}}))});};
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});

test('actual payroll component keeps existing layout and only shows supported diagnostics for scoped and full users',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async data=>act(async()=>{root.render(React.createElement(Screen,{...data,open:()=>{},refresh:async()=>true}));await new Promise(r=>setTimeout(r,20));});
 try{
  await render(scopedPayrollFixture());await act(async()=>{await new Promise(r=>setTimeout(r,20));});
  assert.match(host.textContent,/Cần quyền xem cả Line A và B để phân bổ quỹ chung/);
  assert.doesNotMatch(host.textContent,/Line B: Chưa|Thiếu ngày bắt đầu hợp lệ: Synthetic related B/);
  const selector=host.querySelector('select[aria-label="Line"]');
  assert.ok(!selector||selector.disabled||[...selector.options].every(o=>o.value==='A'),'limited user still cannot choose another Line');
  const table=host.querySelector('table');const headers=[...table.querySelectorAll('thead th')].map(c=>c.textContent);
  const input=scopedPayrollFixture();input.employees=input.employees.map(p=>p.line==='A'?{...p,startDate:''}:p);
  await render(input);assert.match(host.textContent,/Thiếu ngày bắt đầu hợp lệ: Synthetic own A/);
  assert.deepEqual([...host.querySelector('table').querySelectorAll('thead th')].map(c=>c.textContent),headers);
  await render(fullPayrollFixture());assert.ok(host.querySelector('select[aria-label="Line"]'));
  assert.match(host.querySelector('table').textContent,/3\.000\.000/);assert.doesNotMatch(host.textContent,/Cần quyền xem cả Line A và B/);
  const baseline=host.querySelector('table').textContent,dated=fullPayrollFixture();
  dated.reports=attachLaborReferences(dated.reports.map(({standardUnit,...r})=>r),dated.orders,siteLaborHours(dated.orders.map(o=>({key:o.sku,updatedAt:'2026-10-01T00:00:00Z',payload:{sku:o.sku,laborHour:1,version:1}}))));
  await render(dated);assert.equal(host.querySelector('table').textContent,baseline);assert.doesNotMatch(host.textContent,/Chưa đủ giờ công chuẩn hoàn thành/);
 }finally{await act(async()=>root.unmount());host.remove();}
});
