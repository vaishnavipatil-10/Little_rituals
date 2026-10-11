export function classifyExpiry(product, today = new Date().toISOString().slice(0, 10), windowDays = 30) {
  if (product?.status === 'expired') return 'expired';
  if (!product?.expiry_date) return 'unknown';
  const days = Math.floor((Date.parse(`${product.expiry_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(days)) return 'unknown';
  if (days < 0) return 'expired';
  return days <= windowDays ? 'soon' : 'later';
}
