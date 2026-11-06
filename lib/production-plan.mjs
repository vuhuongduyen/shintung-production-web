// Shared business rules. Dates are calendar dates, never browser timezone timestamps.
export const text = value => String(value ?? '').trim();
export const normalized = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toUpperCase().replace(/\s+/g, ' ');
export function dateISO(value) {
    let s = text(value);
    const vi = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (vi)
        s = `${vi[3]}-${vi[2]}-${vi[1]}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '';
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}
export function monday(value) { const s = dateISO(value); if (!s)
    return ''; const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
export function weekEnd(value) { const s = monday(value); if (!s)
    return ''; const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); }
export function weekNumber(value) {
    const start = monday(value);
    if (!start) return null;
    const thursday = new Date(start + 'T00:00:00Z');
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
export const displayDate = value => dateISO(value) ? dateISO(value).split('-').reverse().join('/') : '—';
export const lineOf = value => normalized(value).replace(/^LINE\s*/, '');
export function numberOrNull(value) { if (value === null || value === undefined || text(value) === '' || typeof value === 'boolean')
    return null; const n = Number(text(value).replace(/,/g, '')); return Number.isFinite(n) ? n : null; }
export const matchKey = (week, sku) => `${monday(week)}|${text(sku).toUpperCase()}`;
export const planId = (week, sku, line) => `${displayDate(week).replaceAll('/', '')}-${text(sku).toUpperCase()}-${lineOf(line) || 'NA'}`;
export const statuses = ['DỰ KIẾN', 'ĐÃ CHỐT', 'TẠM HOÃN', 'HỦY', 'ĐÃ CHUYỂN'];
export const planTypes = ['TUẦN CHÍNH', 'GỐI ĐẦU'];
export const priorities = ['GẤP', 'THƯỜNG', 'THƯỜNG - GỐI ĐẦU'];
export function normalizeRow(raw = {}, week = '', index = 0) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const status = normalized(r.status) === 'HOAN' ? 'TẠM HOÃN' : statuses.find(v => normalized(v) === normalized(r.status)) || 'DỰ KIẾN';
    const type = planTypes.find(v => normalized(v) === normalized(r.type)) || 'TUẦN CHÍNH';
    const line = lineOf(r.line), sku = text(r.sku), w = monday(r.week) || monday(week);
    return { ...r, id: text(r.id) || `legacy-${index}`, sku, name: text(r.name), spec: text(r.spec), group: text(r.group), week: w,
        suggested: r.planGroupId&&text(r.id)!==text(r.planGroupId)?null:numberOrNull(r.suggested), plan: numberOrNull(r.plan), line, start: dateISO(r.start), end: dateISO(r.end),
        priority: type === 'GỐI ĐẦU' ? 'THƯỜNG - GỐI ĐẦU' : priorities.find(v => normalized(v) === normalized(r.priority)) || 'THƯỜNG',
        enginePriority: text(r.enginePriority), type, status, sequence: numberOrNull(r.sequence), laborHour: numberOrNull(r.laborHour),
        planId: r.planGroupId&&text(r.groupPlanId)?text(r.groupPlanId):planId(w, sku, line), source: text(r.source) || '05_PRODUCTION_ENGINE', sourceIds: Array.isArray(r.sourceIds) ? r.sourceIds : [],
        createdAt: text(r.createdAt || r.setupAt), createdBy: text(r.createdBy) };
}
export function rowWarnings(row) { const result = []; if (!row.sku)
    result.push('missingSku'); if (!(row.plan > 0))
    result.push('missingQty'); if (!['A', 'B', 'C'].includes(row.line))
    result.push('missingLine'); if (!dateISO(row.start))
    result.push('missingStart'); if (!dateISO(row.end))
    result.push('missingEnd'); if (row.end && row.start && row.end < row.start)
    result.push('dateOrder'); if (!monday(row.week))
    result.push('missingWeek'); if (!(row.laborHour >= 0) || row.laborHour === null)
    result.push('missingLabor'); return result; }
export function plannedLaborHours(row) {
    const plan = numberOrNull(row.plan), perProduct = numberOrNull(row.laborHour);
    return plan === null || plan < 0 || perProduct === null || perProduct < 0
        ? null : Math.round(plan * perProduct * 10000) / 10000;
}
export function summary(rows, capacity, week) {
    return [...new Set(['A', 'B', ...rows.map(r=>r.line).filter(l=>l==='C')])].map(line => {
        const items = rows.filter(r => r.line === line && !['HỦY','TẠM HOÃN'].includes(r.status)), missing = items.filter(r => r.laborHour === null || r.laborHour < 0 || r.plan === null);
        // Missing labor contributes zero to the line total, without changing the row's standard or warning.
        const effectiveBasisMissing=items.some(r=>r.planLaborBasis&&r.planLaborBasis.status!=='resolved');
        const required = items.some(r => r.plan === null) || effectiveBasisMissing ? null : Math.round(items.reduce((sum, r) => sum + r.plan * (r.laborHour === null || r.laborHour < 0 ? 0 : r.laborHour), 0) * 10000) / 10000;
        const latest = capacity.filter(r => !r._deleted && monday(r.week) === monday(week) && lineOf(r.line) === line).sort((a, b) => (numberOrNull(b.updateNumber) || 0) - (numberOrNull(a.updateNumber) || 0))[0];
        const available = latest?.status === 'Đã xác nhận' ? numberOrNull(latest?.availableHours) : null;
        const valid = available !== null && available >= 0;
        const ratio = required === null || !valid ? null : available === 0 ? (required > 0 ? Infinity : 0) : required / available;
        return { ...(effectiveBasisMissing?{effectiveBasisMissing:true}:{}), line, week: monday(week), version: latest?.version ?? null, status: latest?.status || 'Chưa xác nhận Capacity', previousHours: latest?.lastConfirmed?.availableHours ?? null, required, available: valid ? available : null, ratio, difference: required === null || !valid ? null : available - required, missingLabor: missing.length, warning: ratio === null ? 'missing' : ratio > 1 ? 'overload' : missing.length ? 'missing' : ratio >= .9 ? 'near' : 'ok' };
    });
}
// Partition one week's workload without releasing its allocation when a row is
// transferred or hidden by a display filter. Summarize each partition directly:
// subtracting totals would turn an unknown quantity into an invented number.
export function viewSummary(rows, displayedRows, capacity, week) {
    const scoped = rows.filter(row => !row._deleted && monday(row.week) === monday(week));
    const displayedIds = new Set(displayedRows.map(row => row.id));
    const listed = summary(scoped.filter(row => displayedIds.has(row.id)), capacity, week);
    const outside = summary(scoped.filter(row => !displayedIds.has(row.id)), capacity, week);
    return summary(scoped, capacity, week).map(total => {
        const listedLine = listed.find(item => item.line === total.line);
        const outsideLine = outside.find(item => item.line === total.line);
        return {...total, listedRequired: listedLine ? listedLine.required : 0, outsideRequired: outsideLine ? outsideLine.required : 0};
    });
}
export function sortedRows(rows) { return [...rows].sort((a, b) => a.line.localeCompare(b.line) || ((a.sequence ?? 999999) - (b.sequence ?? 999999)) || a.sku.localeCompare(b.sku, 'vi', { numeric: true })); }

// Rebase a user's unsaved cells after a different request advanced the week's revision.
// Never overwrite a cell changed by someone else or a row which is now locked.
export function rebasePlanEdits(pending, original, latestRows) {
    const rows = new Map(latestRows.map(row => [row.id, row]));
    const edits = {}, conflicts = [];
    const same = (a, b, key) => key === 'plan' || key === 'sequence'
        ? (numberOrNull(a) === numberOrNull(b)) : a === b;
    for (const [id, fields] of Object.entries(pending)) {
        const row = rows.get(id);
        if (!row || ['ĐÃ CHỐT', 'ĐÃ CHUYỂN'].includes(row.status)) { conflicts.push(id); continue; }
        const next = {};
        for (const [key, value] of Object.entries(fields)) {
            if (same(row[key], value, key)) continue;
            if (!Object.hasOwn(original[id] || {}, key) || !same(row[key], original[id][key], key)) conflicts.push(id);
            else next[key] = value;
        }
        if (Object.keys(next).length) edits[id] = next;
    }
    return {edits, conflicts:[...new Set(conflicts)]};
}

// UI total for orders still awaiting transfer, independent of capacity reservation rules.
export function remainingPlanSummary(rows, capacity, week) {
    return summary(rows.filter(row => !row._deleted && monday(row.week) === monday(week) && row.status !== 'ĐÃ CHUYỂN'), capacity, week);
}

// Plan ID is the business group label. The persistent row ID remains the source
// of truth for independent transfer, work-order allocation and capacity linkage.
export const primaryPlanRow = row => !row.planGroupId || row.id === row.planGroupId;
export function validPlanGroups(rows) {
    if(new Set(rows.map(row=>row.id)).size!==rows.length)return false;
    const buckets=new Map();
    for(const row of rows){const key=matchKey(row.week,row.sku);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
    return [...buckets.values()].every(items=>{
        if(items.length===1&&!items[0].planGroupId)return true;
        const root=items.find(row=>row.id===row.planGroupId);
        if(!root?.planGroupId||!root.groupPlanId||!items.every(row=>row.planGroupId===root.id&&row.groupPlanId===root.groupPlanId&&row.planId===root.groupPlanId))return false;
        const members=new Map(items.map(row=>[row.id,row])),resolved=new Set([root.id]);
        for(const row of items){const path=new Set();let current=row;
            while(!resolved.has(current.id)){if(path.has(current.id)||!members.has(current.splitFromId))return false;path.add(current.id);current=members.get(current.splitFromId);}
            for(const id of path)resolved.add(id);
        }
        return true;
    });
}
export function transitMatchesPlan(row, transit) {
    if(transit.planRowId)return transit.planRowId===row.id;
    // An unlinked legacy Plan ID cannot identify one sibling of a split group.
    if(row.planGroupId)return false;
    return transit.planId===row.planId||matchKey(transit.week,transit.sku)===matchKey(row.week,row.sku);
}
export function planCoveredByTransit(row, backlog) {
    const has=(values,key)=>typeof values?.has==='function'?values.has(key):(values||[]).includes(key);
    if(has(backlog.coveredRowIds,row.id))return true;
    return !row.planGroupId&&Boolean(row.planId&&has(backlog.coveredPlanIds,row.planId));
}
export const transitPlanAllocationKey = row => row.planGroupId&&row.planRowId?`row:${row.planRowId}`:`plan:${row.planId}`;
