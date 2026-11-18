// Mirror the legacy review blocker without changing hours, reports or approvals.
// Evaluate again inside activation's transaction: production_event is not one
// of the four frozen quantity sources and can change after a readiness read.
export const legacyHoursReadySql=`NOT EXISTS (
 WITH reports AS (
  SELECT j.value AS payload FROM app_records r, json_each(
   CASE WHEN r.entity='production_history_import'
    THEN CASE WHEN json_type(r.payload,'$.reports')='array' THEN json_extract(r.payload,'$.reports') ELSE '[]' END
    WHEN json_type(r.payload,'$.rows')='array' THEN json_extract(r.payload,'$.rows')
    ELSE json_array(json(r.payload)) END
  ) j WHERE r.entity IN ('production_report','production_history_import') AND j.type='object'
 ), requests AS (
  SELECT e.payload,coalesce(json_extract(e.payload,'$.id'),e.record_key) AS id
  FROM app_records e WHERE e.entity='production_event'
   AND json_extract(e.payload,'$.kind')='absence'
   AND json_type(e.payload,'$.approved')='false'
   AND NOT coalesce(json_extract(e.payload,'$.voided'),0)
 )
 SELECT 1 FROM reports r JOIN requests e
  ON json_extract(r.payload,'$.transitId')=json_extract(e.payload,'$.sourceId')
 WHERE json_extract(r.payload,'$.kind')='completion'
  AND json_extract(r.payload,'$.reviewStatus') IN ('Chờ kiểm tra','Lịch sử chờ đối chiếu')
  AND NOT coalesce(json_extract(r.payload,'$.cancelled'),0)
  AND NOT coalesce(json_extract(r.payload,'$.voided'),0)
  AND julianday(json_extract(e.payload,'$.effectiveAt'))<julianday(json_extract(r.payload,'$.completedAt'))
  AND julianday(json_extract(e.payload,'$.endsAt'))>julianday(json_extract(r.payload,'$.startedAt'))
  AND NOT EXISTS (SELECT 1 FROM app_records a WHERE a.entity='production_event'
   AND NOT coalesce(json_extract(a.payload,'$.voided'),0)
   AND json_extract(a.payload,'$.approvedFrom')=e.id)
)`;

export async function assertLegacyHoursReady(db){
 const row=await db.prepare(`SELECT (${legacyHoursReadySql}) AS ready`).first();
 if(row?.ready!==1)throw Object.assign(Error('Còn điều chỉnh giờ đang chờ duyệt của phiếu cũ. QLSX cần xử lý trước khi kích hoạt; chưa chuyển chế độ hoặc thay đổi dữ liệu cũ.'),{status:409});
}
