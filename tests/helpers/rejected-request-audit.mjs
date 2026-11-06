import assert from 'node:assert/strict';

// Only receipts independently checked for a particular rejected request may be
// added to the snapshot. Existing audit rows are never filtered out.
export async function assertRejectedRequestAudit(options){assert.ok(options.response.status>=400,'request must have failed');return assertRequestAudit(options);}
export async function assertRequestAudit({before,after,response,actorId,route,body,receipt=true,mutableEntities=[],replayed=false}) {
 const id=response.headers.get('X-ONSPA-Action-ID');
 if(!receipt){assert.equal(id,null);assert.deepEqual(after,before);return null;}
 assert.match(id||'',/^[0-9a-f-]{36}$/);
 assert.ok(!before.some(r=>r.entity==='website_action_audit'&&r.record_key===id));
 const added=after.filter(r=>r.entity==='website_action_audit'&&r.record_key===id);
 assert.equal(added.length,1,'exactly one receipt correlated with response');
 const row=added[0],p=JSON.parse(row.payload);
 assert.ok(!mutableEntities.includes('website_action_audit'),'existing receipts must never be mutable');
 for(const old of before.filter(r=>r.entity.endsWith('_audit')))assert.deepEqual(after.find(r=>r.entity===old.entity&&r.record_key===old.record_key),old,'all pre-existing audit rows are immutable, including business audits');
 const protectedRows=rows=>rows.filter(r=>!mutableEntities.includes(r.entity));
 assert.deepEqual(protectedRows(after.filter(r=>r!==row)),protectedRows(before),'every protected business record and pre-existing audit must be byte-for-byte unchanged');
 assert.equal(row.updated_by,actorId);assert.equal(p.id,id);assert.equal(p.actorId,actorId);assert.equal(p.actor,actorId);
 assert.equal(p.route,route);
 const entities={'/api/in-transit':'in_transit','/api/production-plan':'production_plan','/api/production-report':'production_report','/api/production-workflow':'production_event','/api/capacity':'capacity','/api/production-correction':'production_report','/api/employees':'employees'};
 assert.equal(p.entity,entities[route]||body.entity||route.replace('/api/',''));
 assert.equal(p.line,typeof body.line==='string'?body.line:'');
 assert.equal(p.httpStatus,response.status);assert.equal(p.evidence,'server');
 const result=await response.clone().json();
 if(response.status<400)assert.equal(Boolean(result.replayed),replayed);
 assert.equal(p.outcome,response.status<400?(replayed?'replayed':'succeeded'):[401,403].includes(response.status)?'denied':'failed');
 assert.equal(p.reason,response.status<400?(replayed?'Yêu cầu đã xử lý trước đó; không ghi lặp.':'Máy chủ xác nhận xử lý thành công.'):result.error);
 assert.ok(Number.isFinite(Date.parse(p.at)));assert.ok(Date.parse(p.finishedAt)>=Date.parse(p.at));assert.ok(Date.parse(row.updated_at)>=Date.parse(p.finishedAt));
 assert.deepEqual(p.submittedInput,{fields:body,limited:false});
 assert.equal(p.record,body.orderId||body.reportId||body.key||body.id||body.week||'');
 const labels={review:'Xác nhận báo công',save:'Lưu',reopen:'reopen',close:'close',start:'Nhập trạm',complete:'Xuất trạm',pause:'Tạm ngưng',resume:'Tiếp tục',cancel:'Hủy'};
 assert.equal(p.operation,labels[body.action]||body.action||'Lưu');
 assert.equal(response.headers.get('X-ONSPA-Audit'),null,'receipt must be finalized');
 return row;
}
export function assertSnapshotWithReceipts(before,after,validated){
 const keys=new Set(before.map(r=>r.entity+'\0'+r.record_key));
 const added=validated.filter(r=>!keys.has(r.entity+'\0'+r.record_key));
 const sort=rows=>[...rows].sort((a,b)=>(a.entity+'\0'+a.record_key).localeCompare(b.entity+'\0'+b.record_key,'en'));
 assert.deepEqual(sort(after),sort([...before,...added]),'only the exact validated receipts may be added');
}
