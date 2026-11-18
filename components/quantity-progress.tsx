import styles from './quantity-progress.module.css';
export default function QuantityProgress({value,total,label='SL hoàn thành SX',approved,pending=0}:{value:number;total:number;label?:string;approved?:number;pending?:number}){
 const amount=Number.isFinite(value)?Math.max(0,value):0,target=Number.isFinite(total)&&total>0?total:null,ratio=target?Math.min(1,amount/target):0;
 const format=(n:number)=>n.toLocaleString('vi-VN');
 const text=target?`${format(amount)} / ${format(target)}`:format(amount),basis=approved===undefined?'':` · Đã xác nhận ${format(approved)} · Chờ xác nhận ${format(pending)}`;
 return <span className={styles.container} title={`${label}: ${text}${basis}`}>
  <span className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target??undefined} aria-valuenow={target?Math.min(amount,target):undefined} aria-valuetext={text+basis}>
   <span className={styles.fill} aria-hidden="true" style={{width:`${ratio*100}%`}}/>
   <span className={styles.amount} aria-hidden="true" style={{left:`${ratio*100}%`,transform:`translateX(-${ratio*100}%)`}}>{format(amount)}</span>
  </span>
  {pending>0&&<small className={styles.pending}>Đã duyệt {format(approved??Math.max(0,amount-pending))} · Chờ {format(pending)}</small>}
 </span>;
}
