// Keep inactive names separately: inactive days must have an empty active roster
// to satisfy capacity validation and avoid allocating/counting staff on days off.
export function setCapacityWorkingDay(input,index,working){
 const current=input.dailySchedule?.[index];
 if(!current||Boolean(current.working)===working)return input;
 return {...input,dailySchedule:input.dailySchedule.map((day,i)=>i===index?{...day,working}:day),
  ...(input.dailyRoster?{dailyRoster:input.dailyRoster.map((roster,i)=>{
   if(i!==index)return roster;
   if(!working)return {...roster,savedHc:[...roster.hc],hc:[],ot:[]};
   const {savedHc,...rest}=roster;
   return {...rest,hc:Array.isArray(savedHc)?[...savedHc]:[...roster.hc]};
  })}:{})};
}
