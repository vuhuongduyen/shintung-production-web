import {sanitizeTestLogValue} from './website-test-log.mjs';
// Guard text is developer-owned SQL; never derive it from client input.
export function recordAuditStatement(db,{entity,key,before,after,actor,at,source='local-records',action},guard='changes()=1',bindings=[]){
 const audit={entity,key,before:sanitizeTestLogValue(before,0,false),after:sanitizeTestLogValue(after,0,false),actor:actor.login,actorId:actor.userId||actor.permissionLogin||actor.login,at,source,...(action?{action}:{})};
 return db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),JSON.stringify(audit),actor.login,at,...bindings);
}
// Commit the audit beside the successful CAS write. Do not use request identity or body dumps.
export async function commitRecordWithAudit(db,write,entry){
 const {entity,before,after}=entry;
 if(JSON.stringify(before??null)===JSON.stringify(after??null)||entity.endsWith('_audit')||entity.endsWith('_history'))return write.run();
 const result=await db.batch([write,recordAuditStatement(db,entry)]);
 return result[0];
}
