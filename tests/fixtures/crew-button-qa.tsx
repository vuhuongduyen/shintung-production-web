import React from 'react';import {createRoot} from 'react-dom/client';import ProductionStageTrial from '../../components/production-stage-trial';
if(!crypto.randomUUID)(crypto as any).randomUUID=()=> '00000000-0000-4000-8000-000000000001';
const order={id:'TEST',lsxCode:'LSX MẪU',sku:'SKU MẪU',line:'B',lsxQty:2000,processes:['ASSY']},state={'["TEST","ASSY"]':{orderId:'TEST',stage:'ASSY',status:'partial',people:['A'],completed:1000,admittedQuantity:2000,at:'2026-10-29T01:00:00Z'}};
createRoot(document.getElementById('root')!).render(<ProductionStageTrial orders={[order]} employees={[{id:'A',name:'Nhân viên mẫu A',line:'B'}]} live request={{order,action:'start'}} trialState={state} onState={()=>{}} onBack={()=>{}}/>);
