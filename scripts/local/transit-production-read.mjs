// In Transit consumes production state/quantity fields, never report source
// snapshots, correction audit copies, employee notes or imported source rows.
// Project them in SQLite before transport/parsing. The workflow/detail reader
// still reads the original records; this does not change persistence or history.
const summary = value => `json_remove(${value},'$.sourceSnapshot','$.history','$.overlapWarnings','$.laborNotes','$.sourceRow','$.before','$.after')`;
// getTransit only merges pending imported quantities; approved history is
// already represented by the saved order baseline. Preserve missing fields
// and JSON booleans while projecting exactly the fields that merge consumes.
const pendingHistory = `(SELECT json_group_object(field.key,json(CASE field.type WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' WHEN 'object' THEN field.value WHEN 'array' THEN field.value ELSE json_quote(field.value) END)) FROM json_each(report.value) field WHERE field.key IN ('id','transitId','kind','reviewStatus','reportedQuantity','voided','cancelled'))`;
export function transitProductionPayload(entity) {
 if(entity==='production_event')return summary('payload');
 if(entity==='production_report')return `CASE WHEN json_type(payload,'$.rows')='array' THEN json_set(${summary('payload')},'$.rows',json((SELECT json_group_array(json(${summary('value')})) FROM json_each(payload,'$.rows')))) ELSE ${summary('payload')} END`;
 if(entity==='production_history_import')return `json_object('_deleted',json_extract(payload,'$._deleted'),'reports',json((SELECT json_group_array(json(${pendingHistory})) FROM json_each(payload,'$.reports') report WHERE json_extract(report.value,'$.reviewStatus') IN ('Chờ kiểm tra','Lịch sử chờ đối chiếu'))))`;
 return 'payload';
}
