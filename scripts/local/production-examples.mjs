import {productionActorId} from "../../lib/production-actor.mjs";
import {vnMoment} from '../../lib/production-attendance.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {monday} from '../../lib/production-plan.mjs';

// Only trusted production SQL reaches this adapter. Auth always uses the real DB.
// Replacing the table, rather than entity values, also isolates cursors, approvals,
// audit entries and warehouse proposals written by the existing workflow.
export function exampleDatabase(db) {
  return {
    prepare(sql) {
      if (!/\bapp_records\b/.test(sql)) throw new Error('Truy vấn ngoài phạm vi LSX mẫu.');
      return db.prepare(sql.replace(/\bapp_records\b/g, 'production_example_records'));
    },
    batch: statements => db.batch(statements),
  };
}
const shift = (date, amount) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0,10);
const at = (date, time) => new Date(`${date}T${time}:00+07:00`).toISOString();

export async function readExampleSet(db) {
  const row = await db.prepare("SELECT payload FROM app_records WHERE entity='example_set' AND record_key='v1'").first();
  return row ? JSON.parse(row.payload) : null;
}

export function productionExamples(now = new Date(), reference = null) {
  // Both example dates are entirely in the past, including the two-day case.
  // Admins can enter these past times without waiting for a future shift.
  const date = shift(vnMoment(now.toISOString()).date, -2), nextDate = shift(date, 1);
  const weeks = [...new Set([monday(date), monday(nextDate)])];
  const employees = ['A','B'].flatMap(line => Array.from({length:10}, (_,i) => ({
    id:`TEST-NV-${line}${String(i+1).padStart(2,'0')}`, name:reference?.employees?.[line]?.[i]?.name || `NV mẫu ${line}${String(i+1).padStart(2,'0')}`, sourceEmployeeId:reference?.employees?.[line]?.[i]?.id, line, active:true,
  })));
  const names = { '01':'Chuyển người từ lệnh đang SX', '02':'Nhập trạm lấy 4 người', '03':'Xuất trạm và sản lượng nhiều ngày', '04':'Hoàn thành trễ, bắt buộc lý do' };
  const orders = ['A','B'].flatMap(line => ['01','02','03','04'].map(code => ({
    id:`TEST-LSX-${line}${code}`, planId:`TEST-PLAN-${line}${code}`, lsxCode:`TEST-${line}${code}`,
    sku:reference?.products?.[line]?.[Number(code)-1]?.code || `TEST-SP-${line}${code}`, name:reference?.products?.[line]?.[Number(code)-1]?.name || names[code], spec:reference?.products?.[line]?.[Number(code)-1]?.specification || 'Dữ liệu mẫu kiểm thử', line,
    week:monday(date), lsxQty:code==='01'||code==='02'?1000:200,
    lsxOpenedAt:code==='04'?shift(date,-1):date, planStart:code==='04'?shift(date,-1):date,
    planEnd:code==='03'?nextDate:code==='04'?shift(date,-1):date,
    syncStatus:'ĐÃ ĐỒNG BỘ', priority:'Thường', note:'LSX mẫu — không áp dụng vào sản xuất thật',
  })));
  const starts = ['A','B'].map(line => ({
    id:`TEST-START-${line}01`, kind:'start', sourceId:`TEST-LSX-${line}01`, line,
    effectiveAt:at(date,'08:00'), recordedAt:now.toISOString(), actor:'Bộ ví dụ LSX', count:10,
    employees:employees.filter(e=>e.line===line).map(e=>e.id), reason:'Khởi tạo lệnh mẫu với 10 người',
  }));
  const records = [
    ...employees.map(e=>['employees',e.id,e]),
    ...orders.map(o=>['in_transit',o.id,o]),
    ...starts.map(e=>['production_event',e.id,e]),
    ...weeks.map(week=>['capacity',week,{schemaVersion:1,rows:['A','B'].map(line=>{
      const staff=employees.filter(e=>e.line===line).map(e=>e.id);
      const days=Array.from({length:7},(_,i)=>({date:shift(week,i),working:true,ot:true,
        hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',
        breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],cleaning:[],otStart:'17:30',otEnd:'21:00'}));
      return {line,status:'Đã xác nhận',reviewStatus:'approved',version:1,khsxAcceptedAt:now.toISOString(),input:{
        workers:10,otWorkers:10,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:staff,ot:staff})),
        // One planned absence, for testing "registered leave but actually present".
        dailyHcLeave:[{date:nextDate,mode:'full',employees:[`TEST-NV-${line}10`]}],dailyOtLeave:[],
      }};
    })}]),
  ];
  const metadata={version:1,labelsVersion:reference?2:1,employees:employees.map(e=>({id:e.id,name:e.name,line:e.line,sourceEmployeeId:e.sourceEmployeeId})),date,nextDate,weeks,createdAt:now.toISOString(),orders:orders.map(o=>({id:o.id,code:o.lsxCode,line:o.line,quantity:o.lsxQty,planEnd:o.planEnd,name:o.name,sku:o.sku,spec:o.spec,purpose:names[o.id.slice(-2)]}))};
  return {metadata,records};
}

export async function createProductionExamples(db,actor,now=new Date(),reference=null) {
  if(!actor?.isAdmin || actor.line) throw Object.assign(new Error('Chỉ admin không giới hạn Line được tạo bộ LSX mẫu.'),{status:403});
  const current=await readExampleSet(db);
  if(current){
    if(reference && current.labelsVersion!==2) {
      const updated=productionExamples(new Date(current.createdAt),reference);
      const labels=updated.records.filter(([entity])=>['employees','in_transit'].includes(entity));
      const records=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('employees','in_transit')").all()).results;
      const marker=JSON.stringify({...current,...updated.metadata,token:crypto.randomUUID()});
      const changes=records.map(row=>{
        const label=labels.find(([entity,key])=>entity===row.entity&&key===row.record_key)?.[2];
        if(!label)throw Error('Không tìm thấy nhãn mẫu để cập nhật.');
        const old=JSON.parse(row.payload),value=row.entity==='employees'?{...old,name:label.name,sourceEmployeeId:label.sourceEmployeeId}:{...old,sku:label.sku,name:label.name,spec:label.spec};
        return db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='example_set' AND record_key='v1' AND payload=?)").bind(JSON.stringify(value),actor.login,now.toISOString(),row.entity,row.record_key,row.payload,marker);
      });
      const guards=records.map(()=>"EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)").join(' AND ');
      const claim=db.prepare(`UPDATE app_records SET payload=? WHERE entity='example_set' AND record_key='v1' AND payload=? AND ${guards}`).bind(marker,JSON.stringify(current),...records.flatMap(r=>[r.entity,r.record_key,r.payload]));
      const result=await db.batch([claim,...changes]);
      if(result[0].meta.changes!==1)throw Object.assign(new Error('Bộ mẫu vừa thay đổi. Tải lại rồi cập nhật tên mẫu.'),{status:409});
      return {ok:true,created:false,examples:await readExampleSet(db)};
    }
    return {ok:true,created:false,examples:current};
  }
  const count=await db.prepare('SELECT count(*) AS total FROM app_records').first();
  if(Number(count.total))throw Object.assign(new Error('Dữ liệu mẫu đã có nhưng thiếu thông tin bộ ví dụ. Không ghi đè dữ liệu.'),{status:409});
  const {metadata,records}=productionExamples(now,reference),token=crypto.randomUUID(),marker={...metadata,token};
  const stamp=now.toISOString(),payload=JSON.stringify(marker);
  // Atomic claim plus conditional inserts: simultaneous clicks never seed twice.
  const statements=[db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'example_set','v1',?,?,? WHERE NOT EXISTS(SELECT 1 FROM app_records)").bind(payload,actor.login,stamp),
    ...records.map(([entity,key,value])=>db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='example_set' AND record_key='v1' AND payload=?)").bind(entity,key,JSON.stringify(entity==='production_event'?{...value,actor:actor.login,actorId:productionActorId(actor)}:value),actor.login,stamp,payload))];
  const result=await db.batch(statements);
  const saved=await readExampleSet(db);
  if(!saved)throw Object.assign(new Error('Chưa tạo được bộ LSX mẫu; vui lòng tải lại.'),{status:409});
  return {ok:true,created:result[0].meta.changes===1,examples:saved};
}

// Read real labels only; all trial operations continue using isolated sample IDs.
export async function exampleReference(sourceDb, catalog) {
 const rows=(await sourceDb.prepare("SELECT record_key,payload FROM app_records WHERE entity='employees' ORDER BY record_key").all()).results;
 const employees={},products={};
 for(const line of ['A','B']) {
   employees[line]=rows.map(r=>({...JSON.parse(r.payload),id:r.record_key})).filter(e=>e.line===line&&e.active!==false&&!e.cancelled&&!e._deleted).slice(0,10);
   products[line]=catalog.map(r=>r.payload).filter(p=>String(p.line).replace(/^Line\s*/i,'').toUpperCase()===line&&usableSku(p)&&p.name&&p.code).slice(0,4);
   if(employees[line].length<10||products[line].length<4)throw Object.assign(new Error(`Bộ thử cần 10 nhân viên và 4 sản phẩm đang dùng trên Line ${line}. Hãy kiểm tra Danh sách nhân viên và SKU Master.`),{status:422});
 }
 return {employees,products};
}
