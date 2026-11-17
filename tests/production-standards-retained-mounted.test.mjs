import {trackBrowserChannels} from './helpers/browser-channels.mjs';
const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createTestServer} from './helpers/vite-test-server.mjs';
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test'});
for(const key of ['window','document','HTMLElement','Event','CustomEvent','Node'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),originalFetch=globalThis.fetch;
const vite=await createTestServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {useProductionStandards}=await vite.ssrLoadModule('/components/production-standards.ts'),{productionDisplayStore:store}=await vite.ssrLoadModule('/lib/production-display-store.mjs'),{clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
const response=value=>Response.json({records:[{key:'SYNTHETIC-SKU',payload:{sku:'SYNTHETIC-SKU',laborHour:value}}]});
function Probe(){const state=useProductionStandards();return React.createElement('output',null,JSON.stringify({values:[...state.values],loading:state.loading,error:state.error}));}
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
test('standards show retained authorized values during refresh, replace them on success and keep them on network failure',async()=>{
 clearClientReads('session');await store.activate('SYNTHETIC-A');store.put('standards',[['SYNTHETIC-SKU',0.5]]);
 let release;globalThis.fetch=()=>new Promise(resolve=>{release=resolve;});
 const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(Probe)));assert.deepEqual(JSON.parse(host.textContent),{values:[['SYNTHETIC-SKU',0.5]],loading:false,error:''});
  await act(async()=>release(response(0.7)));await flush();assert.deepEqual(JSON.parse(host.textContent),{values:[['SYNTHETIC-SKU',0.7]],loading:false,error:''});
  await act(async()=>root.unmount());root=createRoot(host);globalThis.fetch=async()=>{throw Error('Synthetic unavailable');};
  await act(async()=>root.render(React.createElement(Probe)));await flush();const failed=JSON.parse(host.textContent);assert.deepEqual(failed.values,[['SYNTHETIC-SKU',0.7]]);assert.match(failed.error,/Synthetic unavailable/);
 }finally{await act(async()=>root.unmount());host.remove();store.clear();clearClientReads('session');globalThis.fetch=originalFetch;}
});
test('a late standard response cannot populate the next verified account or survive authorization denial',async()=>{
 clearClientReads('session');await store.activate('SYNTHETIC-A');let release;globalThis.fetch=()=>new Promise(resolve=>{release=resolve;});
 const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(Probe)));await act(async()=>root.unmount());clearClientReads('session');await store.activate('SYNTHETIC-B');
  await act(async()=>release(response(99)));await flush();assert.equal(store.get('standards'),null);
  store.put('standards',[['SYNTHETIC-SKU',1]]);globalThis.fetch=async()=>Response.json({error:'Synthetic denied'},{status:403});root=createRoot(host);
  await act(async()=>root.render(React.createElement(Probe)));await flush();assert.deepEqual(JSON.parse(host.textContent).values,[]);assert.equal(store.active(),false);
 }finally{await act(async()=>root.unmount());host.remove();store.clear();clearClientReads('session');globalThis.fetch=originalFetch;}
});
