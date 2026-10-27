// BOM hao hụt is stored as a percentage (e.g. 2 means 2%, not 0.02%).
export function normalizeBomWaste(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—') return '';
  const amount = raw.replace(/\s*%$/, '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(amount) || !Number.isFinite(Number(amount))) return null;
  return `${amount}%`;
}
