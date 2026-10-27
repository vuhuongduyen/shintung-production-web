// Preserve source precision and units. SX_LOG uses vi_VN; 04_IN_TRANSIT is read unformatted.
export function sheetNumber(v){if(v==null||v==='')return null;const n=typeof v==='number'?v:Number(String(v).replaceAll('.','').replace(',','.'));return Number.isFinite(n)?n:null;}
export function sheetMoment(v){
 if(v==null||v==='')return '';
 if(typeof v==='number')return new Date(Math.round((v-25569)*86400000)-7*3600000).toISOString();
 const m=/^(\d{2})\/(0?\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(v).replace(/\s+:/g,':').trim());
 if(!m)return '';const at=`${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${m[1]}`;
 if(!Number.isFinite(Date.parse(at))||new Date(at).toISOString().slice(0,10)!==at)return '';
 return m[4]?`${at}T${m[4]}:${m[5]}:${m[6]||'00'}+07:00`:at;
}
export function sheetDay(v){const m=sheetMoment(v);return m.includes('T')?new Date(Date.parse(m)+7*3600000).toISOString().slice(0,10):m;}
export function sourceReportTiming(row,timeRows){
 const recorded=sheetMoment(row[0]),day=sheetDay(row[9]);
 const own=timeRows.filter(t=>t[2]===row[2]&&t[3]===row[3]&&t[4]===row[4]&&t[5]===row[7]);
 const candidates=own.filter(t=>['BÁO CÔNG','HOÀN THÀNH'].includes(t[6])&&sheetDay(t[7])===day&&Math.abs(Date.parse(sheetMoment(t[0]))-Date.parse(recorded))<10*60000).sort((a,b)=>Math.abs(Date.parse(sheetMoment(a[0]))-Date.parse(recorded))-Math.abs(Date.parse(sheetMoment(b[0]))-Date.parse(recorded)));
 const start=own.filter(t=>t[6]==='BẮT ĐẦU').sort((a,b)=>Date.parse(sheetMoment(a[7]))-Date.parse(sheetMoment(b[7])))[0];
 return {recordedAt:recorded,completedAt:candidates.length?sheetMoment(candidates[0][7]):day,actualStartedAt:start?sheetMoment(start[7]):sheetMoment(row[8]),completionPrecision:candidates.length?'second':'date',startPrecision:start?'second':'date'};
}
