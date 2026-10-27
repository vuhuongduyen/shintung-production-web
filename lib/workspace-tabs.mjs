// Groups expose child menus; only business screens have persistent tabs.
export function isWorkspaceGroup(route) {
  return !route.child || (route.view==='production' && ['production-report','weekly-capacity'].includes(route.child)) || (route.view==='planning' && route.child==='report' && !route.report);
}
// One mounted workspace per menu; instance IDs are never reused after closing.
export function workspaceRouteKey(route) {
  const child = route.view === 'production' && route.child === 'production-report' ? 'report-work' : route.child;
  return `${route.view}:${child || 'overview'}:${route.report || ''}`;
}
export function openWorkspace(state, route) {
  // Parent menus only select the overview; existing child workspaces stay mounted.
  if (isWorkspaceGroup(route)) return {...state, active: null, overviewRoute: route};
  const key = workspaceRouteKey(route);
  const existing = state.tabs.find(tab => tab.key === key);
  const intent = route.approvalEntity ? {approval:route.approvalEntity,sequence:state.nextId} : route.focusSku ? {sku:route.focusSku,sequence:state.nextId} : null;
  if (existing) return {
    ...state, active: existing.id,
    tabs: intent ? state.tabs.map(tab => tab.id === existing.id ? {...tab, intent, route:route.focusSku?{...tab.route,focusSku:route.focusSku}:tab.route} : tab) : state.tabs,
    nextId: intent ? state.nextId + 1 : state.nextId,
  };
  const id = `workspace-${state.nextId}`;
  return {...state, active: id, nextId: state.nextId + 1, tabs: [...state.tabs, {id, key, route, intent}]};
}
export function closeWorkspace(state, id) {
  const index = state.tabs.findIndex(tab => tab.id === id);
  if (index < 0) return state;
  const tabs = state.tabs.filter(tab => tab.id !== id);
  return {...state, tabs, active: state.active === id ? (tabs[Math.min(index, tabs.length - 1)]?.id || null) : state.active};
}
