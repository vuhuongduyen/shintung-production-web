// Read the latest effective weekly close; drafts and reopened snapshots never apply.
export async function readSkuStock(db, code) {
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='inventory_snapshot' AND COALESCE(json_extract(payload,'$._deleted'),0)=0 AND json_extract(payload,'$.status') IN ('Đã chốt','Đã được Production_engine sử dụng') ORDER BY json_extract(payload,'$.weekKey') DESC,json_extract(payload,'$.snapshotAt') DESC,record_key DESC LIMIT 1").first();
 if(!row)return {snapshot:null,stock:null};
 const snapshot=JSON.parse(row.payload),sku=String(code||'').trim().toUpperCase();
 const items=(snapshot.items||[]).filter(item=>String(item.sku||'').trim().toUpperCase()===sku);
 const stock=items.length?items.reduce((sum,item)=>({tpQty:sum.tpQty+Number(item.tpQty||0),kdQty:sum.kdQty+Number(item.kdQty||0)}),{tpQty:0,kdQty:0}):null;
 if(stock)stock.totalQty=stock.tpQty+stock.kdQty;
 return {snapshot:{id:snapshot.id,code:snapshot.code,weekKey:snapshot.weekKey,snapshotAt:snapshot.snapshotAt},stock};
}
