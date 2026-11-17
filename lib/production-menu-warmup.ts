import {clientSessionGeneration} from './data-sync';
import {readProductionPage} from './production-page-cache';
import {productionOrderPageUrl} from './production-order-page-client.mjs';
import {readProductionWorkflow} from './production-workflow-cache';
import {readCapacityLatest} from './capacity-workspace-cache';

// One sequential warm-up per verified login. Never prefetch archived progress,
// payroll, full audit detail or a menu outside the current grants.
export async function warmProductionMenus({login,line,work,progress,schedule,capacity,stopped=()=>false}:{login:string;line?:string;work:boolean;progress:boolean;schedule:boolean;capacity:boolean;stopped?:()=>boolean}) {
 const session=clientSessionGeneration(),valid=()=>session===clientSessionGeneration()&&!stopped();
 const tasks:Array<()=>Promise<unknown>>=[];
 if(work)tasks.push(()=>readProductionPage(productionOrderPageUrl({line:line||'all'}),JSON.stringify([login,line||'all'])));
 if(progress)tasks.push(()=>readProductionWorkflow(false,'progress'));
 if(schedule)tasks.push(()=>readProductionWorkflow(false,'schedule'));
 if(capacity)tasks.push(()=>readCapacityLatest());
 for(const task of tasks){if(!valid())break;try{await task();}catch(error:any){if(error?.status===401||error?.status===403)break;}}
}
