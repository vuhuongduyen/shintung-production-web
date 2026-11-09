import {readLaborHistory} from './labor-rate-source.mjs';
import {canPlanAction} from '../../lib/production-plan-permissions.mjs';
import {acceptedCapacity} from '../../lib/capacity-accepted.mjs';
import {capacityDailyBudgets} from '../../lib/plan-week-load.mjs';
import {readPlanTransitBacklog} from './plan-transit-backlog.mjs';
import {backlogLineSummary} from '../../lib/plan-transit-backlog.mjs';
import {checkPlanDailyLoad} from './plan-daily-load.mjs';
import {calculateCapacity, dailyParticipants, linkedOtLeaveDates} from '../../lib/capacity.mjs';
import {engineDemandMatches} from '../../lib/engine-demand.mjs';
import {usableSku, confirmationStatus} from '../../lib/sku-state.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {applyPlanLaborBasis,planReferenceDate} from '../../lib/plan-effective-basis.mjs';
import {capturePlanLeadtime} from '../../lib/transit-leadtime.mjs';
import {readDailyOutputPolicy} from './production-daily-output.mjs';
import { randomUUID } from 'node:crypto';
import { monday, weekEnd, normalizeRow, matchKey, text, normalized, numberOrNull, dateISO, lineOf, planId, planTypes, priorities, rowWarnings, sortedRows,validPlanGroups,primaryPlanRow,transitMatchesPlan,planCoveredByTransit } from '../../lib/production-plan.mjs';
export class PlanError extends Error {
    constructor(message, status = 400, details = []) { super(message); this.status = status; this.details = details; }
}
const fail = (code, status = 400, details = []) => { throw new PlanError(code, status, details); };
async function read(db, entity) { const { results } = await db.prepare('SELECT record_key,payload,updated_at FROM app_records WHERE entity=? ORDER BY updated_at DESC,record_key').bind(entity).all(); return results.map(r => { try {
    return { key: r.record_key, payload: JSON.parse(r.payload), updatedAt: r.updated_at };
}
catch {
    return { key: r.record_key, payload: null, invalid: true };
} }); }
const active = r => r.payload && typeof r.payload === 'object' && !r.payload._deleted;
const planPolicies=new WeakMap();
function unpack(records) { return records.filter(active).flatMap(r => Array.isArray(r.payload.rows) ? r.payload.rows : Array.isArray(r.payload) ? r.payload : [r.payload]).filter(r => r && typeof r === 'object' && !r._deleted); }
export async function getPlanCapacityDetail(db, week, line) {
 if(!week || monday(week)!==week) fail('invalidWeek');
 if(!['A','B','C'].includes(line)) fail('invalidLine');
 const record=await db.prepare("SELECT payload FROM app_records WHERE entity='capacity' AND record_key=?").bind(week).first();
 const row=record?JSON.parse(record.payload)?.rows?.find(r=>r.line===line):null;
 if(!row?.input) return {week,line,missing:true,days:[]};
 if(row.status!=='Đã xác nhận'||row.reviewStatus!=='approved'||!row.syncedAt||!row.khsxAcceptedAt) fail('Chỉ xem chi tiết khi QLSX đã đồng bộ và KHSX đã xác nhận. Vui lòng hoàn tất xác nhận lịch.',409);
 const input=row.input,result=calculateCapacity(input,week);
 const directory=await read(db,'employees');
 const names=new Map(directory.filter(active).map(r=>[r.key,r.payload.name||r.payload.employeeName||r.key]));
 const entries=Array.isArray(input.dailySchedule)
 ? [...(input.dailyHcLeave||[]).map(r=>({...r,kind:'HC'})),...(input.dailyOtLeave||[]).map(r=>({...r,kind:'TC'}))]
 : ['hc','ot'].flatMap(k=>(input.leaveMode==='counted'&&input[k+'LeaveMode']==='rows'?input[k+'LeaveRows']||[]:input[k+'Leaves']||[]).map(r=>({...r,kind:k==='hc'?'HC':'TC'})));
 const unallocated=result.hasUnallocatedLeave||input.leaveMode==='aggregate';
 return {week,line,status:row.reviewStatus||row.status,factor:input.factor,availableHours:result.availableHours,totalHours:result.hcHours+result.otHours,unallocated,
 days:result.days.map((d,index)=>({date:d.date,working:d.working,hcCount:!d.working?0:Array.isArray(input.dailySchedule)?dailyParticipants(input,index).hcCount:unallocated?null:Math.max(0,Number(input.workers||0)-entries.filter(r=>r.kind==='HC'&&r.mode==='full'&&(r.date||r.from)<=d.date&&(r.to||r.date||r.from)>=d.date).reduce((n,r)=>n+Number(r.people||r.employees?.length||0),0)),hc:unallocated?null:d.hcNet,ot:unallocated?null:d.otNet,
 available:unallocated?null:(d.hcNet+d.otNet)*Number(input.factor)/100,
 absences:entries.filter(r=>(r.date||r.from)<=d.date&&(r.to||r.date||r.from)>=d.date).map(r=>({names:(r.employees||[]).map(id=>names.get(id)||id),people:r.people||r.employees?.length||0,kind:r.kind,period:r.mode==='full'?'full':r.start&&r.end?r.start+'–'+r.end:r.hours?String(r.hours)+' h':r.mode,linkedOt:linkedOtLeaveDates(r,input.dailySchedule).includes(d.date)}))}))};
}
export async function getPlanCapacity(db, week, effectivePlanning, sources={}) {
    if(!week || monday(week)!==week) fail('invalidWeek');
    effectivePlanning??=(await readDailyOutputPolicy(db)).policy?.cutoverReached===true;
    const record=await db.prepare("SELECT payload FROM app_records WHERE entity='capacity' AND record_key=?").bind(week).first();
    const envelope=record?JSON.parse(record.payload):null;
    const [calendarRecords,planRecords,laborRecords]=await Promise.all([read(db,'capacity'),sources.plans||read(db,'production_plan'),sources.labor||read(db,'labor_hours')]);
    const laborHistory=sources.laborHistory||await readLaborHistory(db);
    const laborModel=siteLaborHours(laborRecords.map(r=>({key:r.key,payload:r.payload,updatedAt:r.updatedAt})),null,laborHistory);
    const backlog=await readPlanTransitBacklog(db,week,laborModel.map(r=>r.payload));
    const calendars=unpack(calendarRecords),standards=new Map(laborModel.map(r=>[text(r.payload.sku).toUpperCase(),numberOrNull(r.payload.laborHour)]));
    const datedStandards=new Map(laborModel.map(r=>[text(r.payload.sku).toUpperCase(),r.payload]));
    const otherPlans=unpack(planRecords.filter(r=>r.key!==week)).filter(r=>dateISO(r.start)&&dateISO(r.end)&&r.start<=weekEnd(week)&&!['ĐÃ CHUYỂN','HỦY','TẠM HOÃN'].includes(r.status)&&!planCoveredByTransit(r,backlog)).map(r=>{if(effectivePlanning)return applyPlanLaborBasis(r,datedStandards,sources.planningDate);const labor=standards.get(text(r.sku).toUpperCase());return {...r,laborHour:r.status!=='ĐÃ CHỐT'&&labor!==undefined?labor:r.laborHour};});
    const capacityRows=envelope?.schemaVersion===1&&Array.isArray(envelope.rows)?envelope.rows:[];
    const allLines=[...new Set(['A','B',...capacityRows.map(r=>r.line),...backlog.rows.map(r=>r.line)])];
    return allLines.map(line=>{const row=capacityRows.find(r=>r.line===line)||{line,week,status:'Chưa xác nhận Capacity'};
        const adjusting=['adjust-pending','adjust-approved','adjusting'].includes(row.reviewStatus)||
            row.reviewStatus!=='approved'&&row.version>1&&row.history?.some(event=>event.action==='requestChange'&&event.decision!=='reject');
        const accepted=acceptedCapacity(row);
        const status=accepted.retainedApproval?'Đã xác nhận':!row.reviewStatus||row.reviewStatus==='approved'?row.status:adjusting?'Chờ điều chỉnh':row.reviewStatus==='await-sync'?'Chờ đồng bộ':row.reviewStatus==='pending'?'Chờ KHSX đồng ý':'Chưa xác nhận Capacity';
        return {...backlogLineSummary(backlog,row.line),dailyBudgets:calendars.filter(c=>c.line===row.line).flatMap(capacityDailyBudgets),otherPlans:otherPlans.filter(r=>r.line===row.line),week:row.week,line:row.line,status,reviewStatus:row.reviewStatus||'legacy',canViewDaily:row.status==='Đã xác nhận'&&row.reviewStatus==='approved'&&!!row.syncedAt&&!!row.khsxAcceptedAt,retainedApproval:!!accepted.retainedApproval,version:accepted.version,updateNumber:row.updateNumber,availableHours:accepted.availableHours,confirmedAt:row.confirmedAt,khsxAcceptedAt:row.khsxAcceptedAt,lastConfirmed:row.lastConfirmed?{availableHours:row.lastConfirmed.availableHours,version:row.lastConfirmed.version}:undefined};
    });
}
export async function getPlan(db, week, canReopen = false, catalog = null) {
    if (!week || monday(week) !== week)
        fail('invalidWeek');
    const policy=await readDailyOutputPolicy(db),effectivePlanning=policy.policy?.cutoverReached===true,planningBlocked=effectivePlanning&&policy.policy?.active!==true;
    const [plans, engines, transit, labor, audits] = await Promise.all(['production_plan', 'production_engine', 'in_transit', 'labor_hours', 'production_plan_audit'].map(e => read(db, e)));
    const laborHistory=await readLaborHistory(db);
    const planningDate=planReferenceDate();
    const capacity=await getPlanCapacity(db,week,effectivePlanning,{plans,labor,laborHistory,planningDate});
    const masters = catalog || await read(db,'sku');
    const masterPayloads=masters.map(record=>record?.payload&&typeof record.payload==='object'?record.payload:record);
    const masterBySku=new Map(masterPayloads.map(master=>[text(master?.code).toUpperCase(),master]));
    const withMasterGroup=row=>{const master=masterBySku.get(text(row?.sku).toUpperCase());return master?{...row,group:text(master.group)||text(row.group)}:row;};
    const sources = engines.filter(r => active(r) && monday(r.payload.week) === week && Array.isArray(r.payload.rows)).map(r => ({ key: r.key, generatedAt: r.payload.generatedAt || r.updatedAt, rows: r.payload.rows.filter(x => x && typeof x === 'object' && !x._deleted).map(withMasterGroup) }));
    for(const source of sources)for(const row of source.rows){const master=masterBySku.get(text(row.sku).toUpperCase());row.skuPending=!usableSku(master);}
    const candidates = plans.filter(r => active(r) && monday(r.payload.week || r.key) === week);
    const current = candidates.find(r => r.key === week);
    const envelope = current?.payload;
    const deletedRows = candidates.flatMap(r => Array.isArray(r.payload.rows) ? r.payload.rows : []).filter(r => r && r._deleted);
    const effectiveLabor=siteLaborHours(labor.map(r=>({key:r.key,payload:r.payload,updatedAt:r.updatedAt})),null,laborHistory).map(r=>r.payload);
    const laborBySku=new Map(effectiveLabor.map(item=>[text(item.sku).toUpperCase(),numberOrNull(item.laborHour)]));
    const datedStandards=new Map(effectiveLabor.map(item=>[text(item.sku).toUpperCase(),item]));
    // Draft plans follow the current SKU standard; confirmed/transferred plans retain their historical basis.
    const rows = unpack(candidates).filter(r => r.sku || r.id).map((r, i) => {
        const row=withMasterGroup(normalizeRow(r, week, i));
        if(effectivePlanning)return applyPlanLaborBasis(row,datedStandards,planningDate);
        const current= laborBySku.get(text(row.sku).toUpperCase());
        return !['ĐÃ CHỐT','ĐÃ CHUYỂN'].includes(row.status)&&current!==undefined?{...row,laborHour:current}:row;
    });
    const ambiguous = candidates.length > 1 || !validPlanGroups(rows);
    const result={ week, planningDate, effectivePlanning, planningBlocked, revision: Number(envelope?.revision) || 0, rows: sortedRows(rows), sources, capacity, labor: effectiveLabor,
        transit: unpack(transit).filter(r => monday(r.week) === week).map(withMasterGroup), audit: audits.filter(r => active(r) && r.payload.week === week).map(r => r.payload), canReopen,
        envelope: envelope || {}, deletedRows, warnings: [...(ambiguous ? ['legacyConflict'] : []), ...(plans.some(r => r.invalid) ? ['invalidLegacy'] : [])], legacyKey: current?.key || candidates[0]?.key || null };
    planPolicies.set(result,policy);return result;
}
const write = (db, entity, key, payload, actor, now) => db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(entity, key, JSON.stringify(payload), actor, now);
export async function mutatePlan(db, body, actor) {
    if (!actor?.login)
        fail('loginRequired', 401);
    const { week, action } = body;
    if (!['receive', 'save', 'close', 'reopen', 'transfer', 'split'].includes(action))
        fail('invalidAction');
    if(action==='split'&&!canPlanAction(actor,'save'))fail('permissionDenied',403);
    const state = await getPlan(db, week, !!actor.canReopenPlan, actor.catalog);
    if(state.planningBlocked)fail('Thiếu căn cứ chuyển đổi đã kiểm chứng; chưa ghi kế hoạch. Cần đối chiếu cấu hình.',409);
    if (state.warnings.length || state.legacyKey && state.legacyKey !== week)
        fail('legacyConflict', 409);
    if (!Number.isInteger(body.revision) || body.revision !== state.revision)
        fail('conflict', 409);
    const now = new Date().toISOString(), before = state.rows;
    let next = structuredClone(before), added = 0, existing = 0, updated = 0;
    const extra = [];
    let closingBasis=null;
    if(action==='close'&&state.effectivePlanning){
        const policy=planPolicies.get(state),scope="entity IN ('labor_hours','labor_hours_history','leadtime','leadtime_versions') OR (entity='production_reporting_policy' AND record_key='global') OR (entity='production_legacy_manifest' AND record_key=?)";
        const {results}=await db.prepare(`SELECT entity,record_key,payload,updated_at FROM app_records WHERE ${scope}`).bind(policy.manifestKey).all();
        if(results.find(r=>r.entity==='production_reporting_policy')?.payload!==policy.raw||results.find(r=>r.entity==='production_legacy_manifest')?.payload!==policy.manifestRaw)fail('Căn cứ chuyển đổi vừa thay đổi; tải lại trước khi chốt.',409);
        const expected=JSON.stringify(results.map(r=>[r.entity,r.record_key,r.payload,r.updated_at]));
        if(new TextEncoder().encode(expected).length>8*1024*1024)fail('Căn cứ chốt kế hoạch vượt giới hạn đối chiếu; chưa chốt.',422);
        extra.push(db.prepare(`INSERT INTO app_records SELECT entity,record_key,payload,updated_by,updated_at FROM app_records WHERE entity='production_plan' AND record_key=? AND NOT (((SELECT count(*) FROM app_records WHERE ${scope})=?) AND NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN app_records a ON a.entity=json_extract(j.value,'$[0]') AND a.record_key=json_extract(j.value,'$[1]') WHERE a.payload IS NOT json_extract(j.value,'$[2]') OR a.updated_at IS NOT json_extract(j.value,'$[3]')))` ).bind(week,policy.manifestKey,results.length,expected));
        const values=e=>results.filter(r=>r.entity===e).map(r=>({...JSON.parse(r.payload),_recordKey:r.record_key,_updatedAt:r.updated_at}));
        closingBasis={labor:new Map(siteLaborHours(values('labor_hours').map(p=>({key:p._recordKey,payload:p,updatedAt:p._updatedAt})),null,values('labor_hours_history').map(p=>({key:p._recordKey,payload:p,updatedAt:p._updatedAt}))).map(r=>[text(r.payload.sku).toUpperCase(),r.payload])),leadtime:values('leadtime').flatMap(p=>Array.isArray(p.rows)?p.rows:[{...p,sku:p.sku||p._recordKey}]),versions:values('leadtime_versions')};
    }
    const details = [];
    let splitRowIds=[];
    if (action === 'receive') {
        const storedEngine = (await read(db, 'production_engine')).find(r => r.key === body.sourceKey)?.payload;
        if (Array.isArray(storedEngine?.metrics) && !engineDemandMatches(storedEngine, (await read(db, 'demand_event')).map(r => r.payload)))
            throw new PlanError('Demand event đã thay đổi. Bấm Cập nhật dữ liệu tại Production Engine trước khi chuyển sang Production Plan.', 409);
        const source = state.sources.find(s => s.key === body.sourceKey);
        if (!source)
            fail('missingEngine', 404);
        if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 3000 || new Set(body.ids).size !== body.ids.length)
            fail('invalidSelection');
        const masters = actor.catalog || await read(db,'sku');
        for (const id of body.ids) {
            const matches = source.rows.filter(r => r.id === id);
            const r = matches[0];
            if (matches.length !== 1 || !text(r?.sku) || normalized(r?.priority) === 'KHONG BO SUNG' || !(numberOrNull(r?.suggested) > 0)) {
                details.push({ id, sku:text(r?.sku), reason: 'invalidEngineRow' });
                continue;
            }
            const master = masters.find(m => text(m.payload?.code).toUpperCase() === text(r.sku).toUpperCase());
            if(!usableSku(master?.payload)){const p=master?.payload;details.push({id,sku:r.sku,reason:!p?'skuMissing':p.cancelled||p._deleted||confirmationStatus(p)==='Đã hủy'?'skuCancelled':confirmationStatus(p)!=='Đã xác nhận'?'skuPending':'skuInactive'});continue;}
            const key = matchKey(week, r.sku), old = next.find(p => matchKey(week, p.sku) === key&&primaryPlanRow(p));
            if (state.deletedRows.some(p => matchKey(week, p.sku) === key)) {
                details.push({ id, sku:r.sku, reason: 'deletedConflict' });
                continue;
            }
            const labor = state.labor.filter(x => text(x.sku).toUpperCase() === text(r.sku).toUpperCase()).at(0);
            const masterData=master?.payload&&typeof master.payload==='object'?master.payload:master;
            const sourceFields = { name: text(r.name), spec: text(r.spec), group: text(masterData?.group)||text(r.group), suggested: numberOrNull(r.suggested), enginePriority: text(r.priority), laborHour: numberOrNull(labor?.laborHour), source: '05_PRODUCTION_ENGINE' };
            if (old) {
                existing++;
                if (['ĐÃ CHỐT', 'ĐÃ CHUYỂN'].includes(old.status))
                    continue;
                Object.assign(old, sourceFields, { sourceIds: [...new Set([...old.sourceIds, source.key])], updatedAt: now, updatedBy: actor.login });
                updated++;
            }
            else {
                next.push(normalizeRow({ ...sourceFields, id: randomUUID(), sku: text(r.sku).toUpperCase(), week, line: r.line, plan: numberOrNull(r.suggested), type: 'TUẦN CHÍNH', status: 'DỰ KIẾN', priority: 'THƯỜNG', sourceIds: [source.key], createdAt: now, createdBy: actor.login, updatedAt: now, updatedBy: actor.login }, week));
                added++;
            }
        }
        // Validate the entire selection before issuing any SQL; never partially commit a batch.
        if (details.length)
            fail('batchRejected', 422, details);
    }
    else if(action==='split') {
        if(!Array.isArray(body.ids)||body.ids.length!==1)fail('Chọn đúng một dòng để tách đơn.',422);
        const row=next.find(row=>row.id===body.ids[0]);
        if(!row)fail('missingRow',404);
        if(!['DỰ KIẾN','TẠM HOÃN','HỦY'].includes(row.status))fail('Chỉ tách dòng còn được sửa. Mở lại dòng đã chốt theo quy trình hiện có.',409);
        const linked=(await read(db,'in_transit')).filter(record=>record.payload&&(transitMatchesPlan(row,record.payload)||!row.planGroupId&&(record.payload.planId===row.planId||matchKey(record.payload.week,record.payload.sku)===matchKey(week,row.sku))));
        if(row.transferredAt||linked.length)fail('alreadyTransferred',409);
        const root=next.find(item=>item.id===(row.planGroupId||row.id));
        if(!root)fail('legacyConflict',409);
        const groupPlanId=root.groupPlanId||root.planId;
        if(!row.planGroupId)Object.assign(root,{planGroupId:root.id,groupPlanId});
        const copy=normalizeRow(Object.fromEntries(['sku','name','spec','group','week','line','start','end','priority','type','sequence','laborHour','enginePriority','source','sourceIds'].map(key=>[key,row[key]])),week);
        Object.assign(copy,{id:randomUUID(),planGroupId:root.id,groupPlanId,planId:groupPlanId,splitFromId:row.id,plan:null,suggested:null,status:row.status,createdAt:now,createdBy:actor.login,updatedAt:now,updatedBy:actor.login});
        next.push(copy);splitRowIds=[root.id,copy.id];added=1;
    }
    else {
        const transits = ['transfer', 'reopen'].includes(action) ? await read(db, 'in_transit') : [];
        if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 3000 || new Set(body.ids).size !== body.ids.length)
            fail('invalidSelection');
        const masters = actor.catalog || await read(db,'sku');
        for (const id of body.ids) {
            const row = next.find(r => r.id === id);
            if (!row)
                fail('missingRow', 404, [{ id, reason: 'missingRow' }]);
            if (action === 'save' || (action === 'close' && body.edits?.[id])) {
                if (['ĐÃ CHỐT', 'ĐÃ CHUYỂN'].includes(row.status))
                    fail('locked', 409);
                const edit = body.edits?.[id];
                if (!edit || Object.keys(edit).some(k => !['plan', 'line', 'start', 'end', 'priority', 'sequence', 'type', 'status'].includes(k)))
                    fail('invalidEdit');
                const changed = { ...row, ...edit };
                if ((numberOrNull(changed.plan) === null&&!(row.planGroupId&&!primaryPlanRow(row)&&[null,'',undefined].includes(changed.plan))) || numberOrNull(changed.plan) < 0 || !['', 'A', 'B', 'C'].includes(lineOf(changed.line)) || !planTypes.includes(changed.type) || !priorities.includes(changed.priority) || !['DỰ KIẾN', 'TẠM HOÃN', 'HỦY'].includes(changed.status))
                    fail('invalidEdit');
                if ((changed.start && !dateISO(changed.start)) || (changed.end && !dateISO(changed.end)) || (changed.start && changed.end && changed.end < changed.start))
                    fail('dateOrder');
                if (changed.sequence !== null && changed.sequence !== '' && (!Number.isInteger(Number(changed.sequence)) || Number(changed.sequence) < 1))
                    fail('invalidSequence');
                if (changed.type === 'TUẦN CHÍNH' && changed.priority === 'THƯỜNG - GỐI ĐẦU')
                    changed.priority = 'THƯỜNG';
                const normalizedEdit = normalizeRow(changed, week);
                // Compare against this revision's authoritative values: an unchanged
                // edit envelope does not need Sửa, but any actual edit still does.
                if (action === 'close' && actor.canEditPlan === false && ['plan', 'line', 'start', 'end', 'priority', 'sequence', 'type', 'status'].some(key => normalizedEdit[key] !== row[key]))
                    fail('permissionDenied', 403);
                Object.assign(row, normalizedEdit);
            }
            if (action === 'close') {
                if(closingBasis){
                    Object.assign(row,applyPlanLaborBasis(row,closingBasis.labor,planReferenceDate(now)));
                    row.planLaborBasis={...row.planLaborBasis,closedAt:now,closedBy:actor.login};
                    // Keep the existing close exception for missing labor. It
                    // remains unknown/warned, never replaced with today's rate.
                    row.planLeadtimeBasis=capturePlanLeadtime(row,closingBasis.leadtime,closingBasis.versions,now,actor.login);
                }
                const errors = rowWarnings(row).filter(x => x !== 'missingLabor');
                if (row.status !== 'DỰ KIẾN' || errors.length)
                    fail('cannotClose', 422, [{ id, reason: errors.join(',') || 'invalidStatus' }]);
                const capacity = state.capacity.find(c => monday(c.week) === week && c.line === row.line && c.status === 'Đã xác nhận' && Number.isFinite(c.availableHours));
                if (!capacity) fail('capacityUnconfirmed', 422, [{id,reason:'capacityUnconfirmed'}]);
                row.capacityBasis = {week,line:row.line,version:capacity.version,availableHours:capacity.availableHours,confirmedAt:capacity.confirmedAt};
                extra.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT entity,record_key,payload,updated_by,updated_at FROM app_records WHERE entity='production_plan' AND record_key=? AND NOT EXISTS (SELECT 1 FROM app_records c, json_each(c.payload,'$.rows') r WHERE c.entity='capacity' AND c.record_key=? AND json_extract(r.value,'$.line')=? AND json_extract(r.value,'$.status')='Đã xác nhận' AND (json_extract(r.value,'$.reviewStatus') IS NULL OR json_extract(r.value,'$.reviewStatus')='approved') AND json_extract(r.value,'$.version')=?)").bind(week,week,row.line,capacity.version));
                row.status = 'ĐÃ CHỐT';
                row.closedAt = now;
                row.closedBy = actor.login;
            }
            else if (action === 'reopen') {
                if (!actor.canReopenPlan)
                    fail('reopenForbidden', 403);
                if (row.status === 'ĐÃ CHUYỂN' || row.transferredAt || transits.some(record => record.payload && (transitMatchesPlan(row,record.payload)||!row.planGroupId&&(record.payload.planId===row.planId||matchKey(record.payload.week,record.payload.sku)===matchKey(week,row.sku)))))
                    fail('alreadyTransferred', 409, [{ id, reason: 'alreadyTransferred' }]);
                if (row.status !== 'ĐÃ CHỐT')
                    fail('invalidStatus');
                row.status = 'DỰ KIẾN';
                row.reopenedAt = now;
                row.reopenedBy = actor.login;
                row.reopenReason = text(body.reason);
            }
            else if (action === 'transfer') {
                if (row.status === 'ĐÃ CHUYỂN') {
                    existing++;
                    continue;
                }
                if (row.status !== 'ĐÃ CHỐT' || rowWarnings(row).some(x => x !== 'missingLabor') || normalized(row.enginePriority) === 'KHONG BO SUNG')
                    fail('cannotTransfer', 422);
                if(!row.planGroupId&&transits.some(r=>r.payload?.planRowId&&r.payload.planRowId!==id&&(r.payload.planId===row.planId||matchKey(r.payload.week,r.payload.sku)===matchKey(week,row.sku))))fail('legacyConflict',409);
                const matches = transits.filter(r => r.payload && typeof r.payload === 'object' && transitMatchesPlan(row,r.payload));
                if (matches.length > 1)
                    fail('legacyConflict', 409);
                const old = matches[0];
                if (old && ['HOAN THANH', 'DA HOAN THANH', 'COMPLETED'].includes(normalized(old.payload.status || old.payload.columns?.[16]))) fail('completedOrder', 409);
                if (old?.payload._deleted)
                    fail('legacyConflict', 409);
                const columns = Array.isArray(old?.payload.columns) ? [...old.payload.columns] : Array(39).fill('');
                const fields = { 0: row.planId, 1: row.sku, 2: row.name, 3: row.spec, 4: row.line, 6: row.start, 7: row.end, 8: row.group, 9: 'Kế hoạch tuần', 10: row.priority, 11: row.sequence ?? '', 13: row.plan };
                for (const [i, v] of Object.entries(fields))
                    columns[Number(i)] = v;
                if (!old) {
                    columns[16] = 'CHƯA MỞ LSX';
                    columns[27] = 0;
                    columns[29] = 'CHƯA ĐỒNG BỘ';
                    columns[31] = row.createdAt;
                    columns[32] = actor.login;
                    columns[36] = 0;
                }
                else {
                    columns[29] = normalized(columns[29]) === 'CHUA DONG BO' ? 'CHƯA ĐỒNG BỘ' : 'CÓ THAY ĐỔI';
                    columns[32] = actor.login;
                }
                const target = { ...old?.payload, ...(row.planLeadtimeBasis?{planLeadtimeBasis:structuredClone(row.planLeadtimeBasis)}:{}), ...(row.planLaborBasis?{planLaborBasis:structuredClone(row.planLaborBasis),laborHour:row.laborHour}:{}), planRowId: id, ...(row.planGroupId?{planGroupId:row.planGroupId}:{}), planId: row.planId, week, sku: row.sku, name: row.name, spec: row.spec, line: row.line, group: row.group, plan: row.plan, start: row.start, end: row.end, priority: row.priority, sequence: row.sequence, columns, status: old?.payload.status || 'CHƯA MỞ LSX', syncStatus: columns[29], transferredAt: now, transferredBy: actor.login };
                extra.push(write(db, 'in_transit', old?.key || `plan:${id}`, target, actor.login, now));
                row.status = 'ĐÃ CHUYỂN';
                row.transferredAt = now;
                row.transferredBy = actor.login;
                if (old)
                    existing++;
                else
                    added++;
            }
            row.updatedAt = now;
            row.updatedBy = actor.login;
            updated++;
        }
    }
    if (action === 'transfer' && !updated)
        return { added, existing, updated, errors: 0, revision: state.revision };
    if(state.effectivePlanning){const standards=new Map(state.labor.map(r=>[text(r.sku).toUpperCase(),r]));for(const row of next)Object.assign(row,applyPlanLaborBasis(row,standards));}
    let dailyCapacityCheck=null;
    const schedulingFields=['start','end','line','plan','sequence','status'];
    const schedulingIds=['save','close'].includes(action)?(body.ids||[]).filter(id=>{const old=before.find(r=>r.id===id),row=next.find(r=>r.id===id);return row&&old&&schedulingFields.some(k=>row[k]!==old[k]);}):[];
    if(schedulingIds.length){
        dailyCapacityCheck=await checkPlanDailyLoad(db,week,next,schedulingIds,state.labor,{effectivePlanning:state.effectivePlanning});
        if(dailyCapacityCheck.warnings.length&&body.dailyCapacityAck!==dailyCapacityCheck.token)
            fail('dailyCapacityConfirmation',409,[{id:'dailyCapacity',reason:JSON.stringify(dailyCapacityCheck)}]);
    }
    const audit = { id: randomUUID(), week, action, before: [...state.deletedRows, ...before], after: [...state.deletedRows, ...next], actor: actor.login, at: now, reason: text(body.reason), ...(dailyCapacityCheck?.warnings.length?{dailyCapacityOverride:{by:actor.login,at:now,method:'earliest-day-first',warnings:dailyCapacityCheck.warnings,backlog:dailyCapacityCheck.backlog,token:dailyCapacityCheck.token}}:{}) };
    const envelope = { ...state.envelope, schemaVersion: 2, week, revision: state.revision + 1, rows: [...state.deletedRows, ...next], updatedAt: now, updatedBy: actor.login };
    try {
        await db.batch([write(db, 'production_plan', week, envelope, actor.login, now), ...extra, write(db, 'production_plan_audit', audit.id, audit, actor.login, now)]);
    }
    catch (error) {
        if (action === 'close' && String(error).includes('UNIQUE')) fail(closingBasis?'Căn cứ định mức/Leadtime/Capacity vừa thay đổi; tải lại trước khi chốt.':'capacityChanged',409);
        if (String(error).includes('PLAN_CONFLICT'))
            fail('conflict', 409);
        throw error;
    }
    return { added, existing, updated, errors: 0, revision: envelope.revision, ...(dailyCapacityCheck?{dailyCapacityCheck}:{}), ...(action==='split'?{rows:next.filter(row=>splitRowIds.includes(row.id)),audit}:['save', 'close', 'reopen'].includes(action) ? { rows: next.filter(row => body.ids.includes(row.id)), audit } : {}) };
}
