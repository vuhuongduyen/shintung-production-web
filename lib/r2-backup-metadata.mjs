// Canonical, lossless JSON representation of supported R2 metadata.
const HTTP_FIELDS = ['contentType','contentLanguage','contentDisposition','contentEncoding','cacheControl','cacheExpiry'];
export function canonicalMetadata(httpMetadata = {}, customMetadata = {}) {
  if (!httpMetadata || typeof httpMetadata !== 'object' || Array.isArray(httpMetadata)) throw Error('Invalid HTTP metadata');
  if (!customMetadata || typeof customMetadata !== 'object' || Array.isArray(customMetadata)) throw Error('Invalid custom metadata');
  const http = {};
  for (const field of HTTP_FIELDS) {
    const value = httpMetadata[field];
    if (value === undefined) continue;
    if (field === 'cacheExpiry') {
      const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) throw Error('Invalid cacheExpiry');
      http[field] = date.toISOString();
    } else {
      if (typeof value !== 'string') throw Error('Invalid HTTP metadata: ' + field);
      http[field] = value;
    }
  }
  const custom = {};
  for (const key of Object.keys(customMetadata).sort()) {
    if (typeof customMetadata[key] !== 'string') throw Error('Invalid custom metadata: ' + key);
    custom[key] = customMetadata[key];
  }
  return {httpMetadata:http,customMetadata:custom};
}
export function metadataForPut(metadata) {
  if (!metadata || typeof metadata !== 'object' || !metadata.httpMetadata || !metadata.customMetadata) throw Error('Metadata missing');
  const value = canonicalMetadata(metadata.httpMetadata,metadata.customMetadata);
  if (value.httpMetadata.cacheExpiry !== undefined) value.httpMetadata.cacheExpiry = new Date(value.httpMetadata.cacheExpiry);
  return value;
}
export function assertMetadataShape(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
      !Object.hasOwn(metadata, 'httpMetadata') || !Object.hasOwn(metadata, 'customMetadata'))
    throw Error('Missing explicit HTTP/custom metadata');
  return canonicalMetadata(metadata.httpMetadata, metadata.customMetadata);
}
export function metadataEqual(expected, actual) {
  assertMetadataShape(expected);
  assertMetadataShape(actual);
  return JSON.stringify(canonicalMetadata(expected.httpMetadata,expected.customMetadata)) ===
    JSON.stringify(canonicalMetadata(actual.httpMetadata,actual.customMetadata));
}
export function assertManifest(manifest, {allowLegacyBytesOnly=false}={}) {
  if (manifest.environment !== 'TEST' || !manifest.includesFiles || !Array.isArray(manifest.objects)) throw Error('Invalid TEST R2 manifest');
  if (manifest.format === 'ONSPA-FULL-v2') {
    for (const item of manifest.objects) {
      if (typeof item.object_key !== 'string' || !Number.isSafeInteger(item.size) || typeof item.checksum !== 'string' || !item.metadata) throw Error('Missing v2 object metadata');
      assertMetadataShape(item.metadata);
    }
    return 'full';
  }
  if (manifest.format === 'ONSPA-FULL-v1' && allowLegacyBytesOnly) return 'legacy-bytes-only';
  if (manifest.format === 'ONSPA-FULL-v1') throw Error('Legacy v1 has UNKNOWN metadata; explicit --legacy-bytes-only required. Full restore cannot be verified.');
  throw Error('Unsupported backup format');
}
