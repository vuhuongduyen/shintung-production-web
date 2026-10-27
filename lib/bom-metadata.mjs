const key = value => String(value || '').trim().toUpperCase();
export const bomClassifications = ['THÀNH PHẨM', 'BÁN THÀNH PHẨM', 'THÀNH PHẨM / BTP'];

// Product groups belong to SKU Master. Classification is separate BOM metadata.
export function bomMetadataResolver(masterSkus, baseline = []) {
  const masters = new Map(masterSkus.map(sku => [key(sku.code), sku]));
  const originals = new Map(baseline.map(bom => [key(bom.sku), bom]));
  return bom => {
    let master = masters.get(key(bom.sku));
    if ((master?.confirmation_status || master?.status) === 'Chờ xác nhận') master = master.currentData;
    const category = bomClassifications.includes(bom.category) ? bom.category : originals.get(key(bom.sku))?.category || '';
    return {...bom, group: master?.group || '', category};
  };
}
