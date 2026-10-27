// One shared, memory-only display snapshot. Capabilities are never stored here.
export class SkuReadCancelled extends Error {
  constructor(){super('Phiên làm việc đã thay đổi. Vui lòng tải lại SKU.');this.name='SkuReadCancelled';}
}
export function createSkuDisplayCache({read,getSession=()=>0,getGeneration=()=>0,now=()=>Date.now(),ttl=10000}){
  const listeners=new Set();
  let session=getSession(),generation=getGeneration(),epoch=0,pending=null,successfulGeneration=-1;
  let state={records:null,loading:false,error:null,updatedAt:null};
  function publish(next){state=next;for(const listener of listeners)listener();}
  function clear(){epoch++;pending=null;session=getSession();generation=getGeneration();successfulGeneration=-1;publish({records:null,loading:false,error:null,updatedAt:null});}
  function sync(){if(session!==getSession())clear();else if(generation!==getGeneration()){generation=getGeneration();pending=null;}}
  function snapshot(){sync();return state;}
  function load(force=false){
    sync();if(pending)return pending;
    if(!force&&state.records!==null&&successfulGeneration===generation&&state.updatedAt!==null&&now()-state.updatedAt<ttl)return Promise.resolve(state.records);
    const requestEpoch=epoch,requestSession=session,requestGeneration=generation;
    publish({...state,loading:true,error:null});
    const request=Promise.resolve().then(()=>read(force)).then(records=>{
      if(!Array.isArray(records))throw new Error('Dữ liệu SKU chưa hợp lệ. Vui lòng thử tải lại.');
      return records;
    }).then(records=>{
      sync();if(requestEpoch!==epoch||requestSession!==session)throw new SkuReadCancelled();
      // A real mutation during a read needs a new read, not the stale result.
      if(requestGeneration!==generation)return load(true);
      successfulGeneration=generation;publish({records,loading:false,error:null,updatedAt:now()});return records;
    },error=>{
      sync();if(requestEpoch!==epoch||requestSession!==session)throw new SkuReadCancelled();
      if(requestGeneration!==generation)return load(true);
      if(error?.status===401||error?.status===403){epoch++;pending=null;successfulGeneration=-1;publish({records:null,loading:false,error,updatedAt:null});}
      else publish({...state,loading:false,error});
      throw error;
    }).finally(()=>{if(pending===request)pending=null;});
    pending=request;return request;
  }
  return {snapshot,load,clear,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    // Called only with a successful server confirmation, never unsaved form data.
    replace(records){sync();if(!Array.isArray(records))return;successfulGeneration=-1;publish({...state,records});},
  };
}
