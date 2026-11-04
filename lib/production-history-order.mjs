import {isDailyOutput} from './production-report-model.mjs';
import {legacyEarnedModel} from './production-legacy-earned-basis.mjs';
// Read-only context from a report's proven basis; never a recreated business LSX.
export function productionHistoryOrder(report){
 const daily=isDailyOutput(report),basis=report.legacyEarnedBasis;
 if(!report.transitId||!daily&&basis?.kind!==legacyEarnedModel)return null;
 const label=daily?report:basis,snapshot=label.orderSnapshot?.id===report.transitId?label.orderSnapshot:{};
 const fields=['planId','planGroupId','lsxCode','sku','name','spec','line','lsxQty','processes','planStart','planEnd','actualStartedAt','actualCompletedAt','standardLeadtime'];
 return {...Object.fromEntries(fields.filter(k=>label[k]!==undefined||snapshot[k]!==undefined).map(k=>[k,label[k]??snapshot[k]??null])),id:report.transitId,historicalOnly:true};
}
