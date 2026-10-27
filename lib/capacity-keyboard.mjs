// Preserve native arrow-key behavior in time controls, selects and open staff lists.
export function isCapacityAddRowKey(event,isLastRow,disabled){
 if(disabled||!isLastRow||event.key!=='ArrowDown'||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return false;
 const target=event.target;
 if(target?.tagName==='INPUT')return ['text','number'].includes(target.type);
 return target?.tagName==='SUMMARY'&&Boolean(target.closest?.('details.cap-employee-picker'))&&!target.closest?.('details[open]');
}
