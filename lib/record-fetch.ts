import {notifyActionFailure} from './action-feedback';
// Per-tab revision registry for the shared records API. Never refresh a revision
// just before saving an already edited form: that would conceal a stale edit.
const revisions = new Map<string, Map<string, string | null>>();
const appendOnly = new Set(['leadtime_audit','safety_rule_audit']);
import { announceDataChange, sharedRead, sessionFetch as fetch, subscribeClientReadInvalidation } from './data-sync';
subscribeClientReadInvalidation(reason=>{if(reason==='session')revisions.clear();});

export function knownRecordRevision(entity: string, key: string): string | null | undefined {
  const known = revisions.get(entity);
  return known ? known.get(key) ?? null : undefined;
}
export function acceptRecordRevision(entity: string, key: string, revision: string | null) {
  const known = revisions.get(entity) || new Map<string, string | null>();
  known.set(key, revision);
  revisions.set(entity, known);
}

export async function recordFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, typeof window==='undefined'?'http://localhost':window.location.origin);
  if (url.pathname !== '/api/records') return fetch(input, init);
  if ((init?.method || 'GET').toUpperCase() === 'GET') {
    const response = await sharedRead(input, init);
    if (typeof window==='undefined' || !response.ok || !url.searchParams.get('entity') || url.searchParams.get('summary')) return response;
    try {
      const data = await response.clone().json();
      const entity = url.searchParams.get('entity')!;
      const map = new Map<string, string | null>();
      for (const record of data.records || []) map.set(String(record.key), record.revision ?? null);
      const remembered = revisions.get(entity);
      if (remembered) {
        // A background read must not silently bless a draft opened on older data.
        for (const [key, revision] of map) if (!remembered.has(key)) remembered.set(key, revision);
      } else revisions.set(entity, map);
    } catch { /* Preserve the response for its original caller. */ }
    return response;
  }
  if ((init?.method || '').toUpperCase() !== 'POST' || typeof init?.body !== 'string') return fetch(input, init);
  let body: {entity?: string;key?: string;expectedRevision?: string | null;[key:string]: unknown};
  try { body = JSON.parse(init.body); } catch { return fetch(input, init); }
  if (!body.entity || !body.key) return fetch(input, init);
  const known = revisions.get(body.entity) || (appendOnly.has(body.entity) ? new Map<string,string|null>() : undefined);
  if (!known) { const message='Chưa tải phiên bản dữ liệu. Hãy tải lại danh sách trước khi lưu.'; notifyActionFailure(message); return Response.json({error:message},{status:409}); }
  body.expectedRevision = known.get(body.key) ?? null;
  const response = await fetch(input, {...init,body:JSON.stringify(body)});
  if (response.ok) {
    try { const data=await response.clone().json(); known.set(body.key,data.revision ?? null); announceDataChange(body.entity); }
    catch { known.delete(body.key); }
  }
  return response;
}

export type LinkedRecordOperation = {
  entity: string;
  key: string;
  payload: Record<string, unknown>;
  audit?: Record<string, unknown>;
  operation?: string;
  createOnly?: boolean;
};

export async function linkedRecordFetch(kind: 'bom-change' | 'leadtime' | 'safety-rule' | 'safety-group', operations: LinkedRecordOperation[]): Promise<Response> {
  const prepared = [];
  for (const op of operations) {
    const known = revisions.get(op.entity);
    if (!known) { const message='Chưa tải phiên bản dữ liệu. Hãy tải lại danh sách trước khi lưu.'; notifyActionFailure(message); return Response.json({error:message},{status:409}); }
    prepared.push({...op,expectedRevision:known.get(op.key) ?? null});
  }
  const response = await fetch('/api/linked-records', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,operations:prepared})});
  if (response.ok) {
    try {
      const data = await response.clone().json();
      for (const record of data.records || []) {
        acceptRecordRevision(record.entity,record.key,record.revision);
        announceDataChange(record.entity);
      }
    } catch { for (const op of operations) revisions.get(op.entity)?.delete(op.key); }
  }
  return response;
}
