import {normalized} from './production-plan.mjs';
export function planningHours(value,language='vi'){
 if(value==null||!Number.isFinite(Number(value)))return '—';
 return new Intl.NumberFormat(language==='zh'?'zh-TW':language==='en'?'en-US':'vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));
}
export function enginePriorityTone(value){
 const key=normalized(value).replace(/[–—]/g,'-');
 if(key.includes('KHAN')||key.includes('URGENT'))return 'urgent';
 if(key.includes('CAO')||key==='HIGH')return 'high';
 if(key.includes('DU TON'))return 'stock-event';
 if(key.includes('BU TAI'))return 'load';
 if(key==='MEDIUM')return 'medium';
 if(key==='LOW')return 'low';
 return 'no-add';
}
