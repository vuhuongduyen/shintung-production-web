// Internal validation projection only. The original records remain untouched.
// These audit/display fields are not consumed by writeStageWork, stageHours,
// importedStageEvents, quantity checks or eligibility/conflict checks.
const trimReport = value => `json_remove(${value},'$.sourceSnapshot','$.overlapWarnings','$.laborNotes','$.history')`;
export function stageValidationPayload(entity) {
 if(entity==='production_report')return trimReport('payload');
 if(entity==='production_history_import')return `CASE WHEN json_type(payload,'$.reports')='array' THEN json_set(payload,'$.reports',json((SELECT json_group_array(json(${trimReport('value')})) FROM json_each(payload,'$.reports')))) ELSE payload END`;
 return 'payload';
}
