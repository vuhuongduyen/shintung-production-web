import {auditSubmittedInput} from './audit-submitted-input.mjs';
import {clearClientAttempts,recordClientAttempt} from './client-action-audit';
import {currentActionContext, actionFeedbackScope, isExplicitActionAttempt, notifyActionFailure, mutationFailureMessage} from './action-feedback';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {createReadCache} from './client-read-cache.mjs';
import {createRefreshCoordinator} from './client-refresh-coordinator.mjs';
export const WorkspaceActivityContext=createContext(true);
const sharedReads=createReadCache();
let readGeneration=0;
let sessionGeneration=0;
export class ClientSessionReadCancelled extends Error {
 constructor(){super('Phiên hoặc quyền truy cập đã thay đổi. Vui lòng tải lại dữ liệu.');this.name='ClientSessionReadCancelled';}
}
export function isClientSessionReadCancelled(error:unknown){return error instanceof ClientSessionReadCancelled;}
export function clientSessionGeneration(){return sessionGeneration;}
export function assertClientSessionCurrent(generation:number){if(generation!==sessionGeneration)throw new ClientSessionReadCancelled();}
const invalidationListeners=new Set<(reason:'mutation'|'session')=>void>();
export function clientReadGeneration(){return readGeneration;}
export function subscribeClientReadInvalidation(listener:(reason:'mutation'|'session')=>void){invalidationListeners.add(listener);return ()=>{invalidationListeners.delete(listener);};}
export function clearClientReads(reason:'mutation'|'session'='session'){readGeneration++;if(reason==='session'){sessionGeneration++;clearClientAttempts();}sharedReads.clear();for(const listener of invalidationListeners)listener(reason);}
// Fence both the arrival and later body decoding. A response obtained before an
// account/permission change must not populate a separate module's display cache.
function sessionResponse(response:Response,generation:number):Response {
 assertClientSessionCurrent(generation);
 for(const name of ['json','text','blob','arrayBuffer','formData'] as const){
   const read=response[name].bind(response);
   Object.defineProperty(response,name,{value:async()=>{assertClientSessionCurrent(generation);const value=await read();assertClientSessionCurrent(generation);return value;}});
 }
 const clone=response.clone.bind(response);
 Object.defineProperty(response,'clone',{value:()=>{assertClientSessionCurrent(generation);return sessionResponse(clone(),generation);}});
 return response;
}
export async function sessionFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 if(typeof window==='undefined')return globalThis.fetch(input,init);
 const generation=sessionGeneration;
 const method=(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
 const mutation=!['GET','HEAD','OPTIONS'].includes(method);
 const requestPath=String(input instanceof Request?input.url:input).split('?')[0];
 const auditMutation=mutation&&/\/api\/(change-requests|records|linked-records|basic-master-cancel|bom(?:-bulk|-change|-pdf-reconciliation)?|capacity|employees|engine-run|forecast-import|in-transit|inventory-import|labor-hours|production-(?:allocation|allocation-scope|correction|examples|history-import|hr-hours|plan|report|standards|workflow)|sku-(?:confirm|request|unit-import)|user-permission-setup|storage-upload|feedback)$/.test(requestPath);
 const userAction=mutation||isExplicitActionAttempt();
 const feedbackScope=actionFeedbackScope();
 let auditContext:Record<string,any>|undefined;
 let inlineCancellation=false;
 if(auditMutation){
 let body:Record<string,any>={};try{if(typeof init?.body==='string')body=JSON.parse(init.body);}catch{}
 inlineCancellation=requestPath==='/api/production-correction';
 const active=currentActionContext();
 const labels:Record<string,string>={save:'Lưu',send:'Gửi',review:'Xác nhận báo công',start:'Nhập trạm',pause:'Tạm ngưng',resume:'Tiếp tục',complete:'Xuất trạm','incident-create':'Báo sự cố','incident-confirm':'Xác nhận sự cố','incident-reply':'Gửi hướng xử lý','warehouse-duty':'Ghi nhận phụ kho'};
 const requestId=crypto.randomUUID();
 auditContext={requestId,route:requestPath,record:String(body.orderId||body.reportId||body.key||body.id||''),operation:labels[body.action]||body.action||active?.operation||'Gửi dữ liệu',submittedInput:auditSubmittedInput({request:body,screen:active?.submittedInput}).fields};
 recordClientAttempt({outcome:'attempted',operation:auditContext.operation,...auditContext});
 const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('X-ONSPA-Client-Action-ID',requestId);init={...init,headers};
 }
 try {
   const response=sessionResponse(await globalThis.fetch(input,init),generation);
   let expectedPlanConfirmation=false;
   if(requestPath==='/api/production-plan'&&response.status===409){try{expectedPlanConfirmation=(await response.clone().json()).error==='dailyCapacityConfirmation';}catch{/* Ordinary error handling remains below. */}}
   if(auditContext&&!response.ok)recordClientAttempt({outcome:'ui-blocked',operation:auditContext.operation,...auditContext,httpStatus:response.status,validationMessage:expectedPlanConfirmation?'Chờ KHSX xác nhận xếp vượt giờ khả dụng':mutationFailureMessage(response.status)});
   if(!inlineCancellation&&!expectedPlanConfirmation&&userAction&&feedbackScope===actionFeedbackScope()&&!response.ok)notifyActionFailure(mutationFailureMessage(response.status),undefined,undefined,false,feedbackScope,!auditContext);
   return response;
 } catch(error) {
   if(auditMutation&&generation===sessionGeneration&&!(error instanceof Error&&error.name==='AbortError')&&!init?.signal?.aborted)recordClientAttempt({outcome:'network-unknown',operation:auditContext?.operation||'Gửi yêu cầu ghi dữ liệu',...auditContext});
   if(!inlineCancellation&&userAction&&feedbackScope===actionFeedbackScope()&&generation===sessionGeneration&&!(error instanceof Error&&error.name==='AbortError')&&!init?.signal?.aborted)notifyActionFailure('Không thể kết nối để hoàn tất thao tác. Kiểm tra danh sách đã lưu trước khi thử lại.',undefined,undefined,false,feedbackScope,!auditContext);
   throw error;
 }
}
export async function sharedRead(input:string,init?:RequestInit):Promise<Response>{
 if(typeof window==='undefined')return globalThis.fetch(input,init);
 if(init?.signal||(init?.method||'GET').toUpperCase()!=='GET')return sessionFetch(input,init);
 const generation=sessionGeneration;
 // Do not combine requests carrying different explicit authorization/context.
 const headers=Array.from(new Headers(init?.headers).entries()).sort(([a],[b])=>a.localeCompare(b));
 const key=JSON.stringify([input,init?.credentials||'same-origin',headers]);
 const userAction=isExplicitActionAttempt();
 const feedbackScope=actionFeedbackScope();
 try {
   const response=sessionResponse(await sharedReads.read(key,()=>globalThis.fetch(input,init),{fresh:init?.cache==='reload'}),generation);
   if(userAction&&feedbackScope===actionFeedbackScope()&&!response.ok)notifyActionFailure(mutationFailureMessage(response.status));
   return response;
 } catch(error) {
   if(userAction&&feedbackScope===actionFeedbackScope()&&generation===sessionGeneration&&!(error instanceof Error&&error.name==='AbortError'))notifyActionFailure('Không tải được dữ liệu. Kiểm tra kết nối và thử lại.');
   throw error;
 }
}

// A save changes the source entity. Dependent views re-read their source data;
// no derived value is copied into unrelated records.
const dependencies: Record<string, string[]> = {
  labor_hours: ['sku', 'leadtime_versions', 'safety_rules', 'safety_days', 'employees', 'production_plan', 'production_engine'],
  leadtime: ['sku', 'safety_rules', 'production_engine', 'in_transit'],
  leadtime_versions: ['sku', 'safety_rules', 'production_engine', 'in_transit'],
  safety_rules: ['sku', 'production_engine'],
  safety_rule_groups: ['safety_rules', 'sku', 'production_engine'],
  safety_days: ['sku', 'production_engine'],
  sku: ['leadtime_versions', 'labor_hours', 'safety_rules', 'bom', 'production_engine'],
  employees: ['capacity', 'production_workflow'],
  capacity: ['production_plan', 'production_workflow'],
  production_plan: ['in_transit', 'production_workflow'],
  in_transit: ['production_workflow', 'production_report'],
  production_workflow: ['production_report', 'in_transit', 'warehouse_in'],
  production_report: ['production_workflow', 'in_transit', 'warehouse_in'],
  warehouse_in: ['inventory_snapshot', 'production_engine'],
  warehouse_out: ['inventory_snapshot', 'production_engine'],
  warehouse_transfer: ['inventory_snapshot', 'production_engine'],
  inventory_snapshot: ['production_engine'],
  bom: ['production_engine'],
  bom_change: ['bom'],
  forecast: ['production_engine'],
  demand_event: ['production_engine'],
};

export function affectedEntities(entity: string): string[] {
  return [entity, ...(dependencies[entity] || [])];
}

const eventName = 'onspa-data-changed';
let channel: BroadcastChannel | null = null;
function receive(entity: string) {
  clearClientReads('mutation');
  window.dispatchEvent(new CustomEvent(eventName, { detail: affectedEntities(entity) }));
}
function ensureChannel() {
  try {
    channel ??= new BroadcastChannel('onspa-data-sync');
    channel.onmessage = event => {
      if (typeof event.data === 'string') receive(event.data);
    };
  } catch { /* Focus and interval refresh still work. */ }
}
export function announceDataChange(entity: string) {
  if (typeof window === 'undefined') return;
  receive(entity);
  ensureChannel();
  channel?.postMessage(entity);
}

// Other devices do not share a browser channel. All mounted menus use one
// browser listener/timer; paired focus/visibility events share the same wake.
const refreshCoordinator=createRefreshCoordinator({expire:()=>sharedReads.expire()});
let refreshSubscribers=0;
let stopBrowserRefresh:(()=>void)|undefined;
function subscribeBrowserRefresh(notify:()=>void,poll:boolean,active:()=>boolean){
  const unsubscribe=refreshCoordinator.subscribe(notify,{poll,active});
  if(refreshSubscribers++===0){
    const wake=()=>{if(!document.hidden)refreshCoordinator.refresh('focus');};
    const timer=window.setInterval(()=>{if(!document.hidden)refreshCoordinator.refresh('poll');},45_000);
    window.addEventListener('focus',wake);
    document.addEventListener('visibilitychange',wake);
    stopBrowserRefresh=()=>{window.clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
  }
  return ()=>{unsubscribe();if(--refreshSubscribers===0){stopBrowserRefresh?.();stopBrowserRefresh=undefined;}};
}
export function useDataRefresh(entities: string[], {poll = true}: {poll?: boolean} = {}): number {
  const [revision, setRevision] = useState(0);
  const active=useContext(WorkspaceActivityContext);
  const activeRef=useRef(active), dirty=useRef(false);activeRef.current=active;
  useEffect(()=>{if(active&&dirty.current){dirty.current=false;setRevision(value=>value+1);}},[active]);
  const watched = entities.join('|');
  useEffect(() => {
    ensureChannel();
    const refresh=()=>{if(activeRef.current)setRevision(value=>value+1);else dirty.current=true;};
    const onChange = (event: Event) => {
      const changed = (event as CustomEvent<string[]>).detail;
      if (changed?.some(entity => watched.split('|').includes(entity))) refresh();
    };
    window.addEventListener(eventName, onChange);
    const unsubscribe=subscribeBrowserRefresh(refresh,poll,()=>activeRef.current);
    return () => {window.removeEventListener(eventName,onChange);unsubscribe();};
  }, [watched, poll]);
  return revision;
}

const routeEntities: Record<string, string> = {
  '/api/production-correction': 'production_report',
  '/api/labor-hours': 'labor_hours', '/api/employees': 'employees',
  '/api/sku-request': 'sku', '/api/sku-confirm': 'sku', '/api/sku-unit-import': 'sku',
  '/api/capacity': 'capacity', '/api/production-plan': 'production_plan',
  '/api/in-transit': 'in_transit', '/api/production-workflow': 'production_workflow',
  '/api/production-report': 'production_report', '/api/engine-run': 'production_engine',
  '/api/bom-bulk': 'bom_change', '/api/bom-change': 'bom_change', '/api/bom': 'bom', '/api/forecast-import': 'forecast', '/api/inventory-import': 'inventory_snapshot',
};
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method=(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin).pathname;
  const cacheable=['/api/records','/api/in-transit','/api/production-workflow','/api/capacity','/api/production-plan','/api/pending-approvals','/api/sku-capabilities'].includes(path);
  const response = method==='GET' && cacheable && typeof input==='string' ? await sharedRead(input,init) : await sessionFetch(input, init);
  if (response.ok && (init?.method || 'GET').toUpperCase() !== 'GET') {
    const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin).pathname;
    const entity = routeEntities[path];
    if (entity) announceDataChange(entity);
    else if (path === '/api/records' && typeof init?.body === 'string') {
      try {
        const written = JSON.parse(init.body);
        if (typeof written.entity === 'string') announceDataChange(written.entity);
      } catch { /* Leave the successful response intact. */ }
    }
  }
  return response;
}
