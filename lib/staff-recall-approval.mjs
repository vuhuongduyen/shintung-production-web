import {allocationAuthority} from './production-allocation-queue.mjs';
import {productionActorId} from './production-actor.mjs';
import {productionMenuRights} from './menu-action-access.mjs';
export const recallGroup=line=>line==='C'?'C':['A','B'].includes(line)?'AB':null;
export const recallGroupLabel=group=>group==='AB'?'QLSX Line A/B':'QLSX Line C';
export function canApproveStaffRecall(request,actor,scope){
 const authority=allocationAuthority(actor,scope);
 return request?.kind==='staff-recall'&&request.recall?.status==='pending'&&productionActorId(actor)!==request.owner&&productionMenuRights(actor).manager&&!!authority&&(authority.group==='ADMIN'||authority.group===request.recall.targetGroup);
}
export function canReadStaffRecallReply(request,actor,scope){
 const authority=allocationAuthority(actor,scope);
 return actor.isAdmin||productionActorId(actor)===request.owner||authority?.group===request.recall?.sourceGroup;
}
