'use client';
import {FeedbackActionButton} from './action-feedback';
import {PageTitle} from './onspa-ui/PageTitle';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {useMemo,useState,useSyncExternalStore} from 'react';
import {buildBomHierarchy,visibleBomHierarchy} from '../lib/bom-hierarchy.mjs';
import {bomMetadataResolver} from '../lib/bom-metadata.mjs';
import baseline from '../app/bom-data.json';
import {projectBomSources,bomSourceResolver,bomSourceLabel} from '../lib/bom-source.mjs';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {toolbarLocale,subscribeToolbarLocale,registerToolbarTerms} from './standard-toolbar/translations';
import './bom-hierarchy.css';
type Row=Record<string,any>;
registerToolbarTerms({'Xem cha–con':'查看父子結構'});
export default function BomHierarchy({root,catalog,masterSkus,onBack,onOpenBom}:{root:Row;catalog:Row[];masterSkus:Row[];onBack:()=>void;onOpenBom:(row:any)=>void}){
  const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
  const t=(vi:string,zh:string,en:string)=>locale==='zh'?zh:locale==='en'?en:vi;
  const result=useMemo(()=>{const current=catalog.map(bom=>projectBomSources(bom,masterSkus));return buildBomHierarchy(current.find((row:Row)=>row.sku===root.sku)||projectBomSources(root,masterSkus),current);},[root,catalog,masterSkus]);
  const sourceFor=bomSourceResolver(masterSkus);
  const metadataFor=bomMetadataResolver(masterSkus,baseline);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set()),[limit,setLimit]=useState('all');
  const expanded=new Set(result.nodes.filter(node=>!collapsed.has(node.key)).map(node=>node.key));
  const visible=visibleBomHierarchy(result.nodes,expanded,limit==='all'?Infinity:Number(limit));
  const headers=[t('Lớp','層','Layer'),'STT',t('Mã hàng','品號','Item code'),t('Tên','名稱','Name'),t('Quy cách','規格','Specification'),t('Hao hụt (%)','損耗 (%)','Waste (%)'),t('Lượng dùng','用量','Quantity'),t('Mẫu số','分母','Denominator'),t('Ngày có hiệu lực','生效日期','Effective date'),t('Ngày hết hiệu lực','失效日期','Expiry date'),t('Đơn vị','單位','Unit'),t('Nguồn','來源','Source'),t('Nhóm SP','產品組','Product group'),t('Phân loại','分類','Classification')];
  const warnings:Record<string,string>={missing:t('Chưa có BOM riêng','尚無獨立 BOM','Separate BOM missing'),unconfirmed:t('BOM chưa xác nhận; chưa mở các dòng con','BOM 未確認；未展開子項','BOM unconfirmed; children not expanded'),cycle:t('Liên kết vòng; dừng tại đây','循環連結；於此停止','Cycle detected; stopped here'),ambiguous:t('Có nhiều BOM cùng mã; chưa chọn nguồn','相同品號有多個 BOM；尚未選定來源','Multiple BOMs for this code; source unresolved'),date:t('Ngày hiệu lực không hợp lệ; dòng bị loại khỏi cây','生效日期無效；已排除此列','Invalid validity date; row excluded'),depth:t('Đã tới giới hạn lớp; chưa mở tiếp','已達層數上限','Layer limit reached'),limit:t('Đã tới giới hạn số dòng; chưa mở tiếp','已達列數上限','Row limit reached'),code:t('Thiếu mã hàng','缺少品號','Item code missing')};
  const fields=(node:any)=>{const item=node.item,bom=node.bom;return[`L${node.layer}`,item?.stt||'—',node.code,item?.name||bom?.name||'—',item?.spec||bom?.spec||'—',item?.waste||'—',item?.qty??'—',item?item.denominator||'1':'—',item?.effective||bom?.confirmedDate||'—',item?.expiry||'—',item?.unit||bom?.unit||'—',bomSourceLabel(sourceFor(node.code,item?.source||'')),metadataFor({...bom,sku:node.code}).group||'—',metadataFor({...bom,sku:node.code}).category||'—'];};
  function exportExcel(){
    const esc=(value:any)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const rows=[headers,...visible.map(fields)];
    const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="BOM"><Table>${rows.map(row=>`<Row>${row.map(value=>`<Cell><Data ss:Type="String">${esc(value)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
    const url=URL.createObjectURL(new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`BOM-${root.sku}-${result.date}.xml`;link.click();URL.revokeObjectURL(url);
  }
  return <main className="workspace bom-workspace bom-hierarchy" data-own-language="true">
    <PageTitle>{t('BOM · Cấu trúc cha–con','BOM · 父子結構','BOM · Parent–child structure')}</PageTitle>
    <StandardToolbar name="BomLookupView" items={[
      toolbar.action({onClick:()=>setCollapsed(new Set())},t('Mở tất cả','全部展開','Expand all'),true,'action'),
      toolbar.action({onClick:()=>setCollapsed(new Set(result.nodes.map(node=>node.key)))},t('Thu tất cả','全部收合','Collapse all'),true,'action'),
      toolbar.action({onClick:exportExcel},t('Xuất Excel (.xml)','匯出 Excel (.xml)','Export Excel (.xml)'),true,'action'),
      toolbar.field(t('Lớp hiển thị','顯示層','Visible layers'),[toolbar.select({value:limit,onChange:event=>setLimit(event.target.value)},<><option value="all">{t('Tất cả lớp','所有層','All layers')}</option>{Array.from({length:Math.max(...result.nodes.map(node=>node.layer))+1},(_,layer)=><option key={layer} value={layer}>{t('Đến','至','Through')} L{layer}</option>)}</>)]),
      toolbar.action({onClick:()=>onOpenBom(root)},t('Xem BOM riêng','查看獨立 BOM','View separate BOM'),true,'action'),
      toolbar.action({onClick:onBack},t('Trở lại danh sách BOM','返回 BOM 清單','Back to BOM list'),true,'back'),
    ]}/>
    <p className="bom-tree-context"><strong>{root.sku} · {root.name} · {root.spec||'—'}</strong><span>{t('Phiên bản','版本','Version')} {root.version} · {t('Ngày tra','查詢日期','As of')} {result.date.split('-').reverse().join('/')}</span></p>
    {result.warnings.length>0&&<details className="bom-tree-warnings"><summary>{t('Nhánh cần kiểm tra','待檢查分支','Branches requiring review')} ({result.warnings.length})</summary>{result.warnings.map(warning=><p key={`${warning.key}-${warning.kind}`}>{warning.parentCode?`${warning.parentCode} → `:''}{warning.code}: {warnings[warning.kind]}</p>)}</details>}
    <section className="data-card bom-card bom-fill"><DataTable className="table-wrap"><table className="bom-table bom-tree-table" data-no-pagination="true"><thead><tr>{headers.map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{visible.map(node=>{const values=fields(node);return <tr key={node.key} className={node.layer===0?'bom-tree-root':node.childKeys.length?'bom-tree-parent':''}>{values.map((value,index)=><DataCell key={index}>{index===0?<span className="bom-tree-layer" style={{paddingInlineStart:`${node.layer*18}px`}}>{value}</span>:index===2?<span className="bom-tree-code" style={{paddingInlineStart:`${node.layer*18}px`}}>{node.childKeys.length>0?<FeedbackActionButton className="bom-tree-toggle" aria-label={`${collapsed.has(node.key)?t('Mở','展開','Expand'):t('Thu','收合','Collapse')} ${node.code}`} aria-expanded={!collapsed.has(node.key)} onClick={()=>setCollapsed(current=>{const next=new Set(current);next.has(node.key)?next.delete(node.key):next.add(node.key);return next;})}>{collapsed.has(node.key)?'▸':'▾'}</FeedbackActionButton>:<span className="bom-tree-spacer"/>}{node.bom?<FeedbackActionButton className="sku-link" onClick={()=>onOpenBom(node.bom)}>{value}</FeedbackActionButton>:value}{node.warning&&<span className="bom-tree-warning" title={warnings[node.warning]}> · {warnings[node.warning]}</span>}</span>:value}</DataCell>)}</tr>;})}</tbody></table></DataTable></section>
    <p className="bom-tree-note">{t('Lượng dùng, mẫu số và hao hụt giữ nguyên theo BOM của mã cha trực tiếp.','用量、分母及損耗保留直接父項 BOM 的原值。','Quantity, denominator and waste retain the direct parent BOM values.')}</p>
  </main>;
}
