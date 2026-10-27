// Only table row/structure changes invalidate pagination, never the pager itself.
export function paginationMutation(record) {
  const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
  if (target?.closest?.('.table-pagination')) return false;
  if (target?.closest?.('.table-wrap > table')) return true;
  return [...(record.addedNodes || []), ...(record.removedNodes || [])].some(node =>
    node.nodeType === 1 && (node.matches?.('.table-wrap, .table-wrap > table') || node.querySelector?.('.table-wrap > table'))
  );
}
