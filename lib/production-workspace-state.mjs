import {openWorkspace,workspaceRouteKey} from './workspace-tabs.mjs';
export function savedProductionWorkspace(state){
 const tabs=state.tabs.filter(tab=>tab.route.view==='production');
 return {routes:tabs.map(({route})=>({view:'production',child:route.child,planTab:'base'})),active:tabs.find(tab=>tab.id===state.active)?.key||null};
}
export function restoreProductionWorkspace(state,saved,allowed){
 if(!Array.isArray(saved?.routes)||state.tabs.length)return state;
 let next=state;
 for(const route of saved.routes.slice(0,16)){
  if(route?.view!=='production'||typeof route.child!=='string'||!allowed(route.child))continue;
  next=openWorkspace(next,{view:'production',child:route.child,planTab:'base'});
 }
 return {...next,active:next.tabs.find(tab=>workspaceRouteKey(tab.route)===saved.active)?.id||null};
}
