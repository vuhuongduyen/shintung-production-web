import test from 'node:test';
import assert from 'node:assert/strict';
import {actualCleaningLimit,cleaningLimitError} from '../lib/actual-cleaning-limit.mjs';
const date='2026-09-25';
const day={date,working:true,hcStart:'08:00',hcEnd:'17:00',cleaning:[{people:2,start:'16:00',end:'17:00'}]};
const employees=['ONE','TWO','THREE'].map(id=>({id,line:'A',active:true}));
const reference={key:'2026-09-21:A',workers:99,roster:[{date,hc:['ONE','TWO'],ot:[]}],input:{dailySchedule:[day],dailyHcLeave:[{date,mode:'full',employees:['ONE']}]}};
const options={reference,employees,line:'A',day};
const absence={id:'absent',kind:'line-absence',line:'A',employees:['ONE'],absenceType:'Nghỉ',effectiveAt:`${date}T08:00:00+07:00`,endsAt:`${date}T17:00:00+07:00`,approved:true};
test('initial named actual arrangement ignores Capacity scalar and unconfirmed forecast leave',()=>{
 assert.deepEqual(actualCleaningLimit(options),{known:true,count:2});assert.equal(cleaningLimitError(options),'');
 assert.match(cleaningLimitError({...options,day:{...day,cleaning:[{...day.cleaning[0],people:3}]}}),/đầu ca \(2\)/);
});
test('accepted start-of-day absence changes cap; later absence does not; pending/cancelled absence has no effect',()=>{
 assert.equal(actualCleaningLimit({...options,events:[absence]}).count,1);
 for(const event of [{...absence,approved:false},{...absence,effectiveAt:`${date}T09:00:00+07:00`}])assert.equal(actualCleaningLimit({...options,events:[event]}).count,2);
 assert.equal(actualCleaningLimit({...options,events:[absence,{id:'cancel',kind:'attendance-cancel',supersedes:'absent'}]}).count,2);
});
test('initial borrowing can exceed scalar, later borrowing cannot increase cap and other date/Line cannot leak',()=>{
 const borrowed={id:'loan',kind:'line-movement',line:'B',destinationLine:'A',employees:['THREE'],effectiveAt:`${date}T07:00:00+07:00`,endsAt:`${date}T18:00:00+07:00`};
 const small={...reference,workers:1};
 assert.equal(actualCleaningLimit({...options,reference:small,events:[borrowed]}).count,3);
 for(const patch of [{effectiveAt:`${date}T09:00:00+07:00`},{destinationLine:'B'},{effectiveAt:'2026-09-26T07:00:00+07:00'}])assert.equal(actualCleaningLimit({...options,events:[{...borrowed,...patch}]}).count,2);
 assert.equal(actualCleaningLimit({...options,reference:{...reference,key:'2026-09-21:B'}}).known,false);
 assert.equal(actualCleaningLimit({...options,day:{...day,date:'2026-09-24'}}).known,false);
});
test('missing named directory/roster is unknown, empty named roster is known zero; never fall back to workers',()=>{
 for(const patch of [{employees:[employees[0]]},{reference:{...reference,roster:[]}}]){assert.equal(actualCleaningLimit({...options,...patch}).known,false);assert.match(cleaningLimitError({...options,...patch}),/Chưa đủ danh sách/);}
 assert.equal(actualCleaningLimit({...options,reference:{...reference,roster:[{date,hc:[],ot:[]}],input:{dailySchedule:[day]}}}).count,0);
 assert.equal(cleaningLimitError({...options,reference:undefined,day:{...day,cleaning:[]}}),'');
});
test('dated employment and unique identities determine initial count, without mutating inputs',()=>{
 const source=structuredClone(options),before=structuredClone(source);
 source.employees=[...employees,{...employees[0]}, {id:'FUTURE',line:'A',startDate:'2026-09-26',employmentDatesManaged:true},{id:'ENDED',line:'A',endDate:date,employmentDatesManaged:true}];
 source.reference.roster[0].hc.push('FUTURE','ENDED','ONE');
 const snapshot=structuredClone(source);assert.equal(actualCleaningLimit(source).count,2);assert.deepEqual(source,snapshot);assert.deepEqual(options,before);
});
test('overlapping groups share the cap; sequential groups can reuse it',()=>{
 const groups=[{people:2,start:'15:00',end:'16:00'},{people:2,start:'16:00',end:'17:00'}];
 assert.equal(cleaningLimitError({...options,day:{...day,cleaning:groups}}),'');
 assert.match(cleaningLimitError({...options,day:{...day,cleaning:[groups[0],{...groups[1],start:'15:59'}]}}),/vượt/);
});
test('newly opened day carries last named initial roster without changing approved reference',()=>{
 const next={...day,date:'2026-09-26'},ref={...reference,days:[day,next],roster:[{date,hc:['ONE','TWO'],ot:[]},{date:next.date,hc:[],ot:[]}],input:{dailySchedule:[day,{...next,working:false}]}};
 assert.equal(actualCleaningLimit({...options,day:next,reference:ref}).count,2);
});

test('legacy omitted HC start uses the existing 08:00 schedule default, with actual events at that instant',()=>{
 const legacy={...day};delete legacy.hcStart;
 assert.equal(actualCleaningLimit({...options,day:legacy}).count,2);assert.equal(actualCleaningLimit({...options,day:legacy,events:[absence]}).count,1);
});
