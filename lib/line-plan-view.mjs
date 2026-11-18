import {monday} from './production-plan.mjs';

// Only display values from an already authorized own-Line plan row may cross
// this boundary. Never copy an envelope, source, audit, or nested object.
export const linePlanDisplayFields = ['id','sku','name','spec','week','plan','line','start','end','priority','type','sequence','group','suggested','laborHour','status','planGroupId','planId'];
const scalar = value => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) || value === null;
export const projectLinePlanRow = row => Object.fromEntries(linePlanDisplayFields.filter(key => scalar(row[key])).map(key => [key,row[key]]));

export function linePlanViewState(data, line, week) {
    if (!['A','B'].includes(line) || data?.line !== line || data?.readOnly !== true || data?.scope !== 'unfinished' || data.week !== week || !Array.isArray(data.rows) || data.rows.some(row => !row || row.line !== line || row.week !== week || monday(row.week) !== week)) {
        throw new Error('Không xác minh được phạm vi kế hoạch của Line.');
    }
    return {revision:0, rows:data.rows.map(projectLinePlanRow), sources:[], capacity:[], transit:[], audit:[], warnings:[], canReopen:false};
}
