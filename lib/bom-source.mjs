const key = value => String(value || '').trim().toUpperCase();

export function sourceFromSku(sku) {
  if ((sku?.confirmation_status || sku?.status) === 'Chờ xác nhận') return sku.currentData ? sourceFromSku(sku.currentData) : null;
  const mode = String(sku?.mode || '').trim();
  if (['Mua hàng', 'Mua ngoài', 'Mua'].includes(mode)) return 'Mua';
  if (['Gia công', 'Ủy thác'].includes(mode)) return 'Ủy thác';
  if (['Tự sản xuất', 'Tự chế'].includes(mode)) return 'Tự chế';
  return null;
}

export function bomSourceResolver(masterSkus) {
  const sources = new Map(masterSkus.map(sku => [key(sku.code), sourceFromSku(sku)]));
  return (code, fallback = '') => sources.has(key(code)) ? sources.get(key(code)) || '' : fallback;
}

function historical(item, today) {
  const expiry = String(item.expiry || '').trim();
  if (!expiry || expiry === '—') return false;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(expiry);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : expiry;
  return !/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso <= today;
}

// Source is derived from SKU Master; quantities, revisions and history are untouched.
export function syncBomCatalogSources(catalog, masterSkus, today = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Ho_Chi_Minh'})) {
  const source = bomSourceResolver(masterSkus);
  return catalog.map(bom => ({...bom, items: (bom.items || []).map(item =>
    historical(item, today) ? item : {...item, source: source(item.code, item.source)}
  )}));
}

export function syncBomSources(bom, masterSkus) {
  return syncBomCatalogSources([bom], masterSkus)[0];
}

// Live lookup projection also applies to stopped rows; stored history is untouched.
export function projectBomSources(bom, masterSkus) {
  const source = bomSourceResolver(masterSkus);
  return {...bom, source: source(bom.sku), items: (bom.items || []).map(item => ({...item, source: source(item.code, item.source)}))};
}

// Match the business labels shown by SKU Master in every BOM lookup.
export function bomSourceLabel(source) {
  return source === 'Mua' ? 'Mua ngoài' : source === 'Ủy thác' ? 'Gia công' : source || '—';
}
