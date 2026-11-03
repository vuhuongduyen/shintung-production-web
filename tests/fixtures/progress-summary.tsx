// Automated DOM regression only; user previews use the real app on port 5173.
import {createRoot} from 'react-dom/client';
import ProductionProgressReview from '../../components/production-progress-review';
import {order,employees,reports} from './report-review-data.mjs';
const orders=[{...order,week:'2026-10-26'},{...order,id:'TEST-SECOND',lsxCode:'TEST-SECOND',week:'2026-10-26'}];
const rows=[...reports,...reports.map(r=>({...r,id:`SECOND-${r.id}`,transitId:'TEST-SECOND',lsxCode:'TEST-SECOND'}))];
createRoot(document.getElementById('root')!).render(<ProductionProgressReview orders={orders} reports={rows} events={[]} employees={employees} manager busy={false} refresh={()=>{}} open={()=>{}} active={()=>({count:0,employees:[],known:false,running:false})} onConfirm={async()=>({results:[]})}/>);
