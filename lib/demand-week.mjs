import {monday, weekEnd, displayDate} from './production-plan.mjs';
export function demandWeekLabel(row) {
 const start=monday(row.planningWeekStart);
 return start ? `${displayDate(start)}–${displayDate(weekEnd(start))}` : row.plannedWeek || '—';
}
export function demandMatchesWeek(row, week) {
 const start=monday(row.planningWeekStart || row.delivery);
 return Boolean(start) && start===monday(week);
}
