"use client";
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
type Tier={moq:string;value:string};
export function LeadtimeTiers({value,onChange}:{value:Tier[];onChange?:(rows:Tier[])=>void}){
 const edit=(index:number,key:keyof Tier,text:string)=>onChange?.(value.map((row,i)=>i===index?{...row,[key]:text}:row));
 return <div><p>Mỗi mức gồm ngưỡng lượng và số ngày. Chọn ngưỡng nhỏ nhất đủ lượng lệnh; vượt ngưỡng cuối dùng mức cuối.</p><DataTable className="table-wrap"><table><thead><tr><th>Ngưỡng MOQ (SP)</th><th>Leadtime (ngày)</th>{onChange&&<th>Thao tác</th>}</tr></thead><tbody>{value.map((row,index)=><tr key={index}><td>{onChange?<input aria-label={`MOQ mức ${index+1}`} type="number" min="0" step="any" value={row.moq} onChange={e=>edit(index,'moq',e.target.value)}/>:row.moq}</td><td>{onChange?<input aria-label={`Leadtime mức ${index+1}`} type="number" min="0" step="1" value={row.value} onChange={e=>edit(index,'value',e.target.value)}/>:row.value}</td>{onChange&&<td><FeedbackActionButton type="button" disabled={value.length<=1} disabledExplanation="Cần giữ ít nhất một mức MOQ." onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Xóa mức</FeedbackActionButton></td>}</tr>)}</tbody></table></DataTable>{onChange&&<FeedbackActionButton type="button" disabled={value.length>=100} disabledExplanation="Tối đa 100 mức MOQ cho một phiên bản." onClick={()=>onChange([...value,{moq:'',value:''}])}>Thêm mức MOQ</FeedbackActionButton>}</div>;
}
