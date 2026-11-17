import {siteCatalog} from '../../lib/site-catalog.mjs';
import {readRecordPages} from './production-record-pages.mjs';
import {getTransit} from './in-transit.mjs';
import {readDailyOutputPolicy} from './production-daily-output.mjs';
import {dailyOutputTotalsIndex} from '../../lib/production-daily-output.mjs';
import {productionRuntime} from '../../lib/production-runtime.mjs';
import {progressReviewSummary,progressOrderStatus} from '../../lib/production-progress-review.mjs';
import {productionProgressDisplay} from '../../lib/production-progress-display.mjs';
import {hasMenuPermission,productionMenus,writeActions,normalizePermission} from '../../lib/menu-action-access.mjs';
import {monday,normalized} from '../../lib/production-plan.mjs';
import {normalizeTransit} from '../../lib/in-transit.mjs';
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});};
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
const sourceCode=value=>`CAST(coalesce(nullif(nullif(json_extract(${value},'$.lsxCode'),''),0),nullif(nullif(json_extract(${value},'$.orderCode'),''),0),nullif(nullif(json_extract(${value},'$.mo'),''),0),'') AS TEXT)`;
const completed=new Set(['early','completed','late']);
const fields={LSX:'lsxCode',SKU:'sku','Tên sản phẩm':'name','Plan ID':'planId'};
const orderFields=['id','planId','planGroupId','week','lsxCode','sku','name','spec','unit','line','planningNote','sequence','lsxQty','completedQty','pendingReportQty','inTransitQty','planStart','planEnd','actualStartedAt','actualCompletedAt','status','productionState','progressStatus','syncStatus','revision'];
// The list/detail only consumes SKU display metadata. Do not transport audit,
// BOM or price history, or hash the complete catalog, for every page request.
export async function readProductionPageCatalog(db,{includeProcesses=false,ordersOnly=false}={}){
 const columns=['code','group','productGroup','category','name','productName','specification','spec','quyCach','quy_cach','unit','uom','unitOfMeasure','line','productionLine','_deleted','status','confirmation_status','usage_status'];
 if(includeProcesses)columns.push('processes');
 const expression=`json_object(${columns.flatMap(k=>[`'${k}'`, `json_extract(payload,'$.${k}')`]).join(',')})`;
 const orderSku="coalesce(nullif(nullif(json_extract(payload,'$.sku'),''),0),json_extract(payload,'$.columns[1]'),'')";
 const masterCode="coalesce(nullif(nullif(json_extract(payload,'$.code'),''),0),record_key)";
 const needed=`SELECT upper(trim(${orderSku})) FROM app_records WHERE entity='in_transit' AND coalesce(json_extract(payload,'$._deleted'),0)=0`;
 // Keep unusual Unicode/control-space identifiers for the established JS matcher.
 // Matching the record key also preserves live overrides of bundled legacy SKUs.
 const where="entity='sku'"+(ordersOnly?` AND (upper(trim(${masterCode})) IN (${needed}) OR upper(trim(record_key)) IN (${needed}) OR ${masterCode} GLOB '*[^ -~]*' OR record_key GLOB '*[^ -~]*' OR EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit' AND ${orderSku} GLOB '*[^ -~]*'))`:'');
 const records=await readRecordPages(db,{where,payloadExpression:expression,sizeExpression:expression});
 return siteCatalog(records.map(r=>({key:r.record_key,payload:JSON.parse(r.payload)})));
}
export const canExportProductionWork=actor=>actor?.authMode!=='quick_line'&&Boolean(actor?.isAdmin||(actor?.grants||[]).some(g=>normalizePermission(g)===normalizePermission(productionMenus.work+' / Xuất dữ liệu')));
const productionCursor=async db=>(await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first())?.payload??null;
async function assertCursor(db,before){if(await productionCursor(db)!==before)fail('Báo công vừa thay đổi trong lúc đọc. Tải lại đúng trang và bộ lọc.',409);}
export function productionPageQuery(params,actor){
 if(!hasMenuPermission(actor,productionMenus.work,['Xem',...writeActions]))fail('Không có quyền xem SX báo công.',403);
 const allowed=new Set(['page','sort','field','query','line','status','format','orderId','kind']);
 for(const key of params.keys())if(!allowed.has(key)||params.getAll(key).length!==1)fail('Tham số danh sách không hợp lệ.');
 const page=Number(params.get('page')||1),sort=params.get('sort')||'due',field=params.get('field')||'',query=String(params.get('query')||'').trim(),line=params.get('line')||actor.line||'all',status=params.get('status')||'all';
 if(!Number.isSafeInteger(page)||page<1||!['due','start'].includes(sort)||!['',...Object.keys(fields),'Line','Trạng thái','Tuần kế hoạch'].includes(field)||query.length>200||!['all','A','B','C'].includes(line)||!['all','completed','running','waiting','paused','incident','review','cancelled'].includes(status))fail('Bộ lọc hoặc trang không hợp lệ.');
 if(actor.line&&line!=='all'&&line!==actor.line)fail('Không có quyền đọc Line khác.',403);
 if(Object.hasOwn(fields,field)&&!query)fail('Nhập nội dung tra cứu trước khi tìm kiếm.');
 if(params.has('format')&&params.get('format')!=='csv'||params.has('orderId')&&params.has('format'))fail('Định dạng xuất không hợp lệ.');
 if(field==='Tuần kế hoạch'&&!monday(query))fail('Chọn tuần kế hoạch hợp lệ.');
 return {page,pageSize:10,sort,field,query:field==='Tuần kế hoạch'?monday(query):query,line:actor.line||line,status,filtered:!!field};
}
// Read-only, request-local scope. Values originate in authorized order rows and
// are SQL-quoted here; no caller can supply SQL or use this adapter for writes.
export function productionOrderScope(db,orders,{workflow=false,summary=false}={}){
 const ids=literal(JSON.stringify(orders.map(o=>o.id))),codes=literal(JSON.stringify(orders.map(o=>String(o.lsxCode||'').trim().toUpperCase()))),plans=literal(JSON.stringify(orders.filter(o=>!o.planGroupId).map(o=>String(o.planId||'').trim().toUpperCase())));
 const complexOrder=orders.some(o=>[o.lsxCode,o.planId].some(v=>/[^ -~]|  /.test(String(v||''))));
 const inIds=value=>`${value} IN (SELECT value FROM json_each(${ids}))`;
 const matches=value=>`(${inIds(`json_extract(${value},'$.transitId')`)} OR (coalesce(json_extract(${value},'$.transitId'),'')='' AND (${complexOrder?1:0}=1 OR upper(trim(${sourceCode(value)})) IN (SELECT value FROM json_each(${codes})) OR (${sourceCode(value)}='' AND upper(trim(coalesce(json_extract(${value},'$.planId'),''))) IN (SELECT value FROM json_each(${plans}))) OR coalesce(json_extract(${value},'$.lsxCode'),json_extract(${value},'$.planId'),'') GLOB '*[^ -~]*' OR instr(coalesce(json_extract(${value},'$.lsxCode'),json_extract(${value},'$.planId'),''),'  ')>0)))`;
 const event=value=>`(${inIds(`json_extract(${value},'$.sourceId')`)} OR ${inIds(`json_extract(${value},'$.destinationId')`)})`;
 // Summary consumers only use pending import quantities. Filter before building
 // scoped JSON; otherwise approved history/source copies are repeatedly rebuilt
 // by SQLite for every projected field, then discarded by the summary reader.
 const pending=summary?" AND json_extract(value,'$.reviewStatus') IN ('Chờ kiểm tra','Lịch sử chờ đối chiếu')":'';
 const historyPayload=workflow?`json_set(payload,'$.reports',json((SELECT json_group_array(json(value)) FROM json_each(payload,'$.reports') WHERE ${matches('value')})),'$.timeEvents',json((SELECT json_group_array(json(value)) FROM json_each(payload,'$.timeEvents') WHERE ${event('value')})))`:`json_object('_deleted',json_extract(payload,'$._deleted'),'reports',json((SELECT json_group_array(json(value)) FROM json_each(payload,'$.reports') WHERE ${matches('value')}${pending})))`;
 const globalEvent=workflow?` OR (coalesce(json_extract(payload,'$.sourceId'),'')='' AND coalesce(json_extract(payload,'$.destinationId'),'')='')`:'';
 const source=`(SELECT entity,record_key,CASE WHEN entity='production_history_import' THEN ${historyPayload} WHEN entity='production_report' AND json_type(payload,'$.rows')='array' THEN json_set(payload,'$.rows',json((SELECT json_group_array(json(value)) FROM json_each(payload,'$.rows') WHERE ${matches('value')}))) ELSE payload END AS payload,updated_by,updated_at FROM app_records WHERE entity NOT IN ('in_transit','production_report','production_event','production_history_import') OR entity='in_transit' AND ${inIds('record_key')} OR entity='production_report' AND (json_type(payload,'$.rows')='array' OR ${matches('payload')}) OR entity='production_event' AND (${event('payload')}${globalEvent}) OR entity='production_history_import' AND (EXISTS(SELECT 1 FROM json_each(payload,'$.reports') WHERE ${matches('value')})${workflow?` OR EXISTS(SELECT 1 FROM json_each(payload,'$.timeEvents') WHERE ${event('value')})`:''}))`;
 return {prepare(sql){if(!/^\s*SELECT\b/i.test(sql))fail('Phạm vi danh sách chỉ cho phép đọc.',403);return db.prepare(sql.replace(/\bapp_records\b/g,source));}};
}
function rowMatches(order,badge,q){
 if(!q.filtered)return !completed.has(badge.tone);
 if(q.field==='Trạng thái')return q.status==='all'||(q.status==='completed'?completed.has(badge.tone):badge.tone===q.status);
 if(q.field==='Line')return true;
 if(q.field==='Tuần kế hoạch')return order.week===q.query;
 return String(order[fields[q.field]]||'').toLocaleLowerCase('vi').includes(q.query.toLocaleLowerCase('vi'));
}
function wireOrder(order,totals,badge,runtime){return {...Object.fromEntries(orderFields.filter(k=>order[k]!==undefined).map(k=>[k,order[k]])),serverSummary:{totals,badge,runtime:{known:runtime.known,running:runtime.running}}};}
const transitValue=(field,index,alternate)=>`coalesce(nullif(json_extract(payload,'$.${field}'),''),${alternate?`nullif(json_extract(payload,'$.${alternate}'),''),`:''}json_extract(payload,'$.columns[${index}]'),'')`;
const dateSql=value=>{const iso=`CASE WHEN length(${value})=10 AND substr(${value},3,1)='/' AND substr(${value},6,1)='/' THEN substr(${value},7,4)||'-'||substr(${value},4,2)||'-'||substr(${value},1,2) ELSE ${value} END`;return `CASE WHEN length(${iso})=10 AND date(${iso},'+0 days')=${iso} THEN ${iso} ELSE NULL END`;};
const rawLine=transitValue('line',4),lineSql=`CASE WHEN upper(trim(${rawLine})) LIKE 'LINE %' THEN trim(substr(trim(${rawLine}),6)) ELSE trim(${rawLine}) END`;
const rawWeek=`coalesce(nullif(json_extract(payload,'$.week'),''),nullif(json_extract(payload,'$.planStart'),''),nullif(json_extract(payload,'$.start'),''),json_extract(payload,'$.columns[6]'),'')`,weekDate=dateSql(rawWeek),weekSql=`date(${weekDate},'-'||((cast(strftime('%w',${weekDate}) AS INTEGER)+6)%7)||' days')`;
// A stored sync label alone is not a runnable order: normalizeTransit also
// requires an LSX code, positive quantity and opening date. Skip only definite
// empty/zero values here; unusual spellings/formats still use the shared matcher.
const orderDirectory=`WITH directory AS (SELECT record_key,${transitValue('lsxCode',5)} AS lsxCode,${transitValue('planId',0)} AS planId,json_extract(payload,'$.planGroupId') AS planGroupId,${transitValue('sku',1)} AS sku,${lineSql} AS line,${weekSql} AS week,${dateSql(transitValue('planStart',6,'start'))} AS startDate,${dateSql(transitValue('planEnd',7,'end'))} AS dueDate FROM app_records WHERE entity='in_transit' AND coalesce(json_extract(payload,'$._deleted'),0)=0 AND coalesce(nullif(json_extract(payload,'$.syncStatus'),''),json_extract(payload,'$.columns[29]'),'') NOT IN ('','CHƯA ĐỒNG BỘ','CÓ THAY ĐỔI','LỖI ĐỒNG BỘ') AND ${transitValue('lsxCode',5)}<>'' AND ${transitValue('lsxOpenedAt',15)}<>'' AND coalesce(json_extract(payload,'$.lsxQty'),json_extract(payload,'$.columns[14]'),0) NOT IN (0,'','0'))`;
export async function* matchingProductionOrders(db,actor,q,catalog=[]){
 const where=['1'],args=[];
 if(q.line!=='all'){where.push('line=?');args.push(q.line);}
 // ASCII code searches can be narrowed before reading any production context.
 // Non-ASCII/name candidates use the shared JS matcher after bounded reads;
 // SQLite lower()/NOCASE must not silently drop Vietnamese matches.
 if(q.query&&['LSX','SKU','Plan ID'].includes(q.field)&&/^[\x20-\x7e]+$/.test(q.query)){where.push(`instr(lower(${fields[q.field]}),lower(?))>0`);args.push(q.query);}
 if(q.field==='Tuần kế hoạch'){where.push('week=?');args.push(q.query);}
 // Bound the aggregation window, independently of the 10-row UI page.
 // Completed orders still need the shared summary (corrections can reopen
 // them). Aggregate at most 500 candidates per window rather than re-reading
 // the same imported history for every 100. UI pages remain 10 rows and
 // payload transport remains byte-bounded by readRecordPages (512 KiB).
 const windowSize=500;
 const sortField=q.sort==='start'?'startDate':'dueDate';let offset=0;
 for(;;){
  const candidates=(await db.prepare(orderDirectory+` SELECT record_key,lsxCode,planId,planGroupId FROM directory WHERE ${where.join(' AND ')} ORDER BY coalesce(week,'9999'),coalesce(${sortField},'9999'),record_key LIMIT ${windowSize} OFFSET ?`).bind(...args,offset).all()).results;
  if(!candidates.length)break;
  const orders=candidates.map(r=>({...r,id:r.record_key})),scope=productionOrderScope(db,orders,{summary:true});
  const state=await getTransit(scope,{},catalog,{includeHistory:false,includeProductionSummary:true,skipLeadtime:true}),totals=dailyOutputTotalsIndex(state.rows,state.summaryReports),byId=new Map(state.rows.map(o=>[o.id,o]));
  for(const candidate of orders){const o=byId.get(candidate.id);if(!o)fail('Định danh lệnh đã thay đổi hoặc không khớp dữ liệu đã lưu. Tải lại và đối chiếu trước khi tiếp tục.',409);if(o.syncStatus!=='ĐÃ ĐỒNG BỘ'||!o.lsxCode)continue;
   const reports=state.summaryReports.filter(r=>r.transitId===o.id),events=state.summaryEvents.filter(e=>!e.voided&&(e.sourceId===o.id||e.destinationId===o.id)),runtime=productionRuntime(o,events),summary=progressReviewSummary(o,state.summaryReports,events);
   const badge=o.status==='HỦY'?{label:'Đã hủy',tone:'cancelled'}:!runtime.known&&!reports.length&&productionProgressDisplay(o.progressStatus)||progressOrderStatus(summary,runtime,events);
   if(rowMatches(o,badge,q))yield wireOrder(o,totals.get(o.id),badge,runtime);
  }
  offset+=candidates.length;if(candidates.length<windowSize)break;
 }
}
const headers=['Lệnh sản xuất','SKU','Tên SP','Quy cách','Line','Ghi chú','Thứ tự SX','SL lệnh','SL đã duyệt','SL chờ duyệt','KH bắt đầu','KH hoàn thành','Trạng thái','Plan ID'];
function csv(values){return values.map(value=>{let s=String(value??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')+'\r\n';}
export async function productionOrderPage(db,actor,params,catalog=[]){
 const query=productionPageQuery(params,actor);
 if(params.get('format')==='csv'&&!canExportProductionWork(actor))fail('Không có quyền xuất dữ liệu SX báo công.',403);
 const [activation,cursor,loadedCatalog]=await Promise.all([readDailyOutputPolicy(db),productionCursor(db),typeof catalog==='function'?catalog():catalog]);
 catalog=loadedCatalog;
 if(activation.policy?.cutoverReached&&!activation.policy.active)fail(activation.policy.blockedReason,503);
 if(!activation.policy?.active)return {supported:false};
 if(params.has('orderId')){const result=await readProductionOrderDetail(db,actor,params,catalog,activation.policy);await assertCursor(db,cursor);return result;}
 if(params.get('format')==='csv'){
  const encoder=new TextEncoder(),iterator=matchingProductionOrders(db,actor,query,catalog)[Symbol.asyncIterator]();let first=true;
  const stream=new ReadableStream({async pull(controller){try{if(first){first=false;controller.enqueue(encoder.encode('\ufeff'+csv(headers)));return;}const {value:r,done}=await iterator.next();if(done){await assertCursor(db,cursor);controller.close();return;}controller.enqueue(encoder.encode(csv([r.lsxCode,r.sku,r.name,r.spec,r.line,r.planningNote,r.sequence,r.lsxQty,r.serverSummary.totals.approved,r.serverSummary.totals.pending,r.planStart,r.planEnd,r.serverSummary.badge.label,r.planId])));}catch(error){controller.error(error);}},async cancel(){await iterator.return?.();}});
  return new Response(stream,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="ONSPA-SX-bao-cong.csv"','cache-control':'no-store'}});
 }
 const rows=[],last=[],totals={orders:0,quantity:0,approved:0,pending:0,reserved:0};
 const start=(query.page-1)*query.pageSize;
 for await(const row of matchingProductionOrders(db,actor,query,catalog)){
  if(totals.orders>=start&&rows.length<query.pageSize)rows.push(row);
  last.push(row);if(last.length>query.pageSize)last.shift();
  totals.orders++;totals.quantity+=Number(row.lsxQty||0);for(const k of ['approved','pending','reserved'])totals[k]+=Number(row.serverSummary.totals[k]||0);
 }
 const pages=Math.max(1,Math.ceil(totals.orders/query.pageSize)),page=Math.min(query.page,pages);
 await assertCursor(db,cursor);
 return {supported:true,orders:page===query.page?rows:last.slice(-((totals.orders-1)%query.pageSize+1)),page,pageSize:query.pageSize,total:totals.orders,totals,filters:query,dailyOutputPolicy:activation.policy,rights:{work:hasMenuPermission(actor,productionMenus.work,writeActions),export:canExportProductionWork(actor),line:actor.line||null}};
}
const reportColumns=['id','transitId','planId','lsxCode','sku','name','spec','line','kind','reportingModel','quantityOnly','reportedQuantity','approvedQuantity','reviewStatus','warehouseStatus','version','productionAt','productionDate','productionLocalDateTime','startedAt','completedAt','reportedAt','reportedBy','reportedById','actorId','reviewedBy','reviewedById','reviewedAt','note','delayReason','stageName','stageCode','stageReporting','erpStageImport','stageQuantity','cancelled','voided','hours','standardUnit','rateBasis','rateStatus','rateIssue','earnedStandardHours','laborNotes','legacyEarnedBasis','sourceVerified','historicalImport','sourceLaborHours','sourcePeriodHours','pendingCorrection'];
const eventColumns=['id','kind','sourceId','destinationId','line','destinationLine','effectiveAt','endsAt','recordedAt','actor','actorId','stageName','stageCode','stageReporting','stageAction','sourceTimeLog','sourceOperation','reportId','quantity','count','employees','reason','voided'];
const projectSql=(value,columns)=>`json_object(${columns.flatMap(k=>[`'${k}'`,['quantityOnly','cancelled','voided','stageReporting','erpStageImport','sourceVerified','historicalImport','sourceTimeLog'].includes(k)?`json(CASE json_type(${value},'$.${k}') WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' ELSE 'null' END)`:`json_extract(${value},'$.${k}')`]).join(',')})`;
async function readProductionOrderDetail(db,actor,params,catalog,policy){
 const id=String(params.get('orderId')||''),kind=params.get('kind')||'reports',page=Number(params.get('page')||1),pageSize=20;
 if(!id||id.length>250||!['reports','events'].includes(kind)||!Number.isSafeInteger(page)||page<1)fail('Phạm vi chi tiết không hợp lệ.');
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(id).first();if(!row)fail('Không còn lệnh để tra cứu.',404);
 const stored=JSON.parse(row.payload),raw=normalizeTransit({...stored,id});if(stored._deleted)fail('Lệnh đã lưu trữ; tra cứu tại lịch sử được phân quyền.',404);if(actor.line&&raw.line!==actor.line)fail('Không có quyền đọc Line khác.',403);
 const scope=productionOrderScope(db,[{...raw,id}],{summary:true}),state=await getTransit(scope,{},catalog,{includeHistory:false,includeProductionSummary:true,skipLeadtime:true}),order=state.rows.find(o=>o.id===id);if(!order)fail('Không còn lệnh để tra cứu.',404);
 const totals=dailyOutputTotalsIndex([order],state.summaryReports).get(id);
 const code=String(raw.lsxCode||'').trim(),plan=String(raw.planId||'').trim();
 const match=`(json_extract(p,'$.transitId')=? OR (coalesce(json_extract(p,'$.transitId'),'')='' AND (upper(trim(${sourceCode('p')}))=upper(?) OR (?=1 AND ${sourceCode('p')}='' AND upper(trim(coalesce(json_extract(p,'$.planId'),'')))=upper(?)))))`;
 const reportSource=`WITH sources AS (SELECT record_key AS source,-1 AS n,0 AS priority,payload AS p,updated_at AS at FROM app_records WHERE entity='production_report' AND coalesce(json_type(payload,'$.rows'),'')<>'array' UNION ALL SELECT a.record_key,h.key,0,h.value,a.updated_at FROM app_records a,json_each(a.payload,'$.rows') h WHERE a.entity='production_report' AND json_type(a.payload,'$.rows')='array' UNION ALL SELECT a.record_key,h.key,1,h.value,a.updated_at FROM app_records a,json_each(a.payload,'$.reports') h WHERE a.entity='production_history_import' AND coalesce(json_extract(a.payload,'$._deleted'),0)=0), ranked AS (SELECT coalesce(nullif(json_extract(p,'$.id'),''),CASE WHEN n<0 THEN source ELSE source||':'||n END) AS id,p,at,row_number() OVER(PARTITION BY coalesce(nullif(json_extract(p,'$.id'),''),CASE WHEN n<0 THEN source ELSE source||':'||n END) ORDER BY priority,at DESC,source DESC) AS rank FROM sources), selected AS (SELECT * FROM ranked WHERE rank=1 AND ${match}${actor.line?" AND json_extract(p,'$.line')=? AND (json_type(p,'$.orderSnapshot') IS NULL OR json_type(p,'$.orderSnapshot')='null' OR json_extract(p,'$.orderSnapshot.line')=?)":''})`;
 const eventSource=`WITH sources AS (SELECT record_key AS source,-1 AS n,0 AS priority,payload AS p,updated_at AS at FROM app_records WHERE entity='production_event' UNION ALL SELECT a.record_key,h.key,1,h.value,coalesce(json_extract(a.payload,'$.createdAt'),a.updated_at) FROM app_records a,json_each(a.payload,'$.timeEvents') h WHERE a.entity='production_history_import' AND coalesce(json_extract(a.payload,'$._deleted'),0)=0), ranked AS (SELECT coalesce(nullif(json_extract(p,'$.id'),''),CASE WHEN n<0 THEN source ELSE source||':'||n END) AS id,p,at,row_number() OVER(PARTITION BY coalesce(nullif(json_extract(p,'$.id'),''),CASE WHEN n<0 THEN source ELSE source||':'||n END) ORDER BY priority,at DESC,source DESC) AS rank FROM sources), selected AS (SELECT * FROM ranked WHERE rank=1 AND (json_extract(p,'$.sourceId')=? OR json_extract(p,'$.destinationId')=?) AND NOT (coalesce(json_extract(p,'$.erpStageImport'),0)=0 AND EXISTS(SELECT 1 FROM app_records replaced WHERE replaced.entity='production_history_import' AND json_extract(replaced.payload,'$.erpStageImport')=1 AND EXISTS(SELECT 1 FROM json_each(replaced.payload,'$.scope.orderIds') WHERE value=json_extract(p,'$.sourceId')) AND julianday(json_extract(p,'$.effectiveAt'))>=julianday(json_extract(replaced.payload,'$.scope.from')||'T00:00:00+07:00') AND julianday(json_extract(p,'$.effectiveAt'))<=julianday(json_extract(replaced.payload,'$.scope.to')||'T23:59:59+07:00')))${actor.line?" AND (json_extract(p,'$.line')=? OR json_extract(p,'$.destinationLine')=?)":''})`;
 const aliases=kind==='reports'?await legacyDetailAliases(db,reportSource.slice(0,reportSource.lastIndexOf(', selected AS')),raw):[];
 const aliasMatch=`(coalesce(json_extract(p,'$.transitId'),'')='' AND (${sourceCode('p')},CAST(coalesce(json_extract(p,'$.planId'),'') AS TEXT)) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)))`;
 const reportWithAliases=reportSource.replace('rank=1 AND '+match,'rank=1 AND ('+match+' OR '+aliasMatch+')');
 const sql=kind==='reports'?reportWithAliases:eventSource,args=kind==='reports'?[id,code,raw.planGroupId?0:1,plan,JSON.stringify(aliases),...(actor.line?[actor.line,actor.line]:[])]:[id,id,...(actor.line?[actor.line,actor.line]:[])];
 const total=(await db.prepare(sql+' SELECT count(*) AS n FROM selected').bind(...args).first()).n,pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(page,pages),columns=kind==='reports'?reportColumns:eventColumns;
 const businessTime="coalesce(CASE WHEN json_extract(p,'$.reportingModel')='daily-finished-v1' AND json_extract(p,'$.quantityOnly')=1 THEN coalesce(json_extract(p,'$.productionAt'),json_extract(p,'$.productionDate')) ELSE json_extract(p,'$.completedAt') END,json_extract(p,'$.effectiveAt'),json_extract(p,'$.reportedAt'),at)";
 const data=(await db.prepare(sql+` SELECT id,${projectSql('p',columns)} AS payload FROM selected ORDER BY julianday(CASE WHEN length(${businessTime})=10 THEN ${businessTime}||'T00:00:00+07:00' ELSE ${businessTime} END) DESC,id LIMIT ? OFFSET ?`).bind(...args,pageSize,(current-1)*pageSize).all()).results.map(r=>({...JSON.parse(r.payload),id:r.id}));
 if(kind==='events'&&actor.line)for(const e of data){if(e.sourceId&&e.sourceId!==id||e.destinationId&&e.destinationId!==id)e.reason='Chuyển Line';if(e.sourceId!==id)e.sourceId=null;if(e.destinationId!==id)e.destinationId=null;if(e.line!==actor.line)e.line=actor.line;}
 return {supported:true,orders:[wireOrder(order,totals,{},productionRuntime(order,state.summaryEvents))],reports:kind==='reports'?data:[],events:kind==='events'?data:[],page:current,pageSize,total,kind,totals,dailyOutputPolicy:policy};
}

async function legacyDetailAliases(db,base,order){
 const result=[],complex=[order.lsxCode,order.planId].some(v=>/[^ -~]|  /.test(String(v||'')));
 const code=sourceCode('p'),plan="CAST(coalesce(json_extract(p,'$.planId'),'') AS TEXT)";
 for(let offset=0;;offset+=500){
  const rows=(await db.prepare(base+` SELECT DISTINCT ${code} AS code,${plan} AS plan FROM ranked WHERE rank=1 AND coalesce(json_extract(p,'$.transitId'),'')='' AND (?=1 OR ${code} GLOB '*[^ -~]*' OR ${plan} GLOB '*[^ -~]*' OR instr(${code},'  ')>0 OR instr(${plan},'  ')>0) ORDER BY code,plan LIMIT 500 OFFSET ?`).bind(complex?1:0,offset).all()).results;
  for(const r of rows){const key=String(r.code||'').trim();if(key?normalized(key)===normalized(order.lsxCode):!order.planGroupId&&!!order.planId&&normalized(r.plan)===normalized(order.planId))result.push([r.code,r.plan]);}
  if(rows.length<500)break;
 }
 return result;
}
