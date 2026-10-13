/**
 * Utility helpers for product size options (Measurement + Size Name + Individual Price)
 */

export const formatSizeLabel = (sizeOption) => {
  if (!sizeOption) return '';
  if (typeof sizeOption === 'string') return sizeOption;
  const measurement = (sizeOption.measurement || '').toString().trim();
  const name = (sizeOption.name || '').toString().trim();

  if (measurement && name && measurement.toLowerCase() !== name.toLowerCase()) {
    return `${measurement} (${name})`;
  }
  return measurement || name || 'Standard';
};

export const getProductPriceRange = (product) => {
  if (!product) return { minPrice: 0, maxPrice: 0, isRange: false };
  if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
    const prices = product.sizes.map((s) => Number(s.price)).filter((p) => !isNaN(p) && p >= 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return { minPrice: min, maxPrice: max, isRange: min !== max };
    }
  }
  const hasDiscount = Boolean(
    product.discountPrice &&
      Number(product.discountPrice) > 0 &&
      Number(product.discountPrice) < Number(product.price)
  );
  const fallback = hasDiscount
    ? Number(product.discountPrice)
    : product.price || 0;
  return { minPrice: fallback, maxPrice: fallback, isRange: false };
};

export const DEFAULT_BEDSHEET_SIZES = [
  { measurement: '48×75', name: 'Double', price: 344 },
  { measurement: '60×75', name: 'Queen', price: 481 },
  { measurement: '60×78', name: 'Queen', price: 471 },
  { measurement: '72×72', name: 'King', price: 501 },
  { measurement: '72×75', name: 'King', price: 501 },
  { measurement: '72×78', name: 'King', price: 449 },
  { measurement: '72×84', name: 'King', price: 549 },
  { measurement: '', name: 'Free Size', price: 525 },
];
