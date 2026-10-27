import type {CellKind} from './DataCell';
/** Presentation metadata keyed by the field, never by fmt() or the displayed value. */
export const inTransitCellKinds = {
  group:'code',sku:'code',line:'code',planId:'code',lsxCode:'code',unit:'code',planRowId:'code',
  name:'text',spec:'text',reason:'text',actor:'text',cancelReason:'text',delayReason:'text',
  planningUpdatedBy:'text',syncError:'text',
  actualStartedAt:'date',actualCompletedAt:'date',planningUpdatedAt:'date',productionReceivedAt:'date',
  standardLeadtime:'number',actualLeadtime:'number',leadtimeVariance:'number',delayDays:'number',
  planningUpdateCount:'number',productionReceiveCount:'number',
} as const satisfies Record<string,CellKind>;
export type InTransitDisplayField=keyof typeof inTransitCellKinds;
export function inTransitCellKind(field:InTransitDisplayField):CellKind {return inTransitCellKinds[field];}
