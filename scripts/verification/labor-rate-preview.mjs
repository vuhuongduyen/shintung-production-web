// Offline, read-only analysis of an explicitly supplied export. No DB/network.
import {readFile} from 'node:fs/promises';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {previewLaborRateBackfill} from '../../lib/labor-rate-timeline.mjs';
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/verification/labor-rate-preview.mjs /path/to/review-export.json');
const data=JSON.parse(await readFile(input,'utf8'));
if(!Array.isArray(data.labor)||!Array.isArray(data.history)||!Array.isArray(data.reports))throw Error('Expected labor, history and reports arrays.');
const menu=siteLaborHours(data.labor,null,data.history),bySku=new Map(menu.map(r=>[String(r.payload.sku||r.key).toUpperCase(),r.payload]));
const history=data.history.map(r=>{const h=r.payload||r;return {...h,at:h.at||r.updatedAt};});
const review=previewLaborRateBackfill(data.reports,bySku);
console.log(JSON.stringify({mode:'preview-only-no-writes',rules:'effective-date-otherwise-version-update-date',caution:'An unmarked erroneous/test entry cannot be classified automatically. Review each history row before authorizing corrections or any backfill.',menu:menu.filter(r=>data.labor.some(x=>(x.key||x.sku)==r.key)).map(r=>({sku:r.key,versions:r.payload.resolvedRateVersions,issues:r.payload.rateTimelineIssues})),history:history.map(h=>({id:h.id,sku:h.sku,version:h.version,value:h.newLaborHour,effectiveFrom:h.effectiveFrom??null,recordedAt:h.at??null,reason:h.reason??null,isTest:h.isTest===true||h.usage==='test'||h.status==='test'})),reports:review,totals:review.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})},null,2));
