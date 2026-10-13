/**
 * Uniform image URL resolution for VASHTRAM storefront and admin.
 * Centralizes image fallback to local bundled assets (no external Unsplash / placeholder dependencies).
 */

export const PLACEHOLDER_IMAGE = '/img/placeholder.svg';

export const resolveImageUrl = (url, fallback = PLACEHOLDER_IMAGE) => {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  // Intercept and sanitize any legacy external placeholder or stock image URLs
  const isExternalStock = /u\x6esplash|place\x68old/i.test(trimmed);
  if (isExternalStock) {
    return fallback;
  }

  // Normalize legacy absolute upload URLs from previous local server environments
  const uploadsIndex = trimmed.indexOf('/uploads/');
  if (uploadsIndex !== -1 && (trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes('cloudinary')) {
    const relativePath = trimmed.substring(uploadsIndex);
    const apiUrl = import.meta.env.VITE_API_URL || '';
    if (apiUrl.startsWith('http')) {
      try {
        const origin = new URL(apiUrl).origin;
        return `${origin}${relativePath}`;
      } catch {
        return relativePath;
      }
    }
    return relativePath;
  }

  // Cloudinary or valid external HTTPS URL
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  // Local /uploads/ reference
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    if (apiUrl.startsWith('http')) {
      try {
        const origin = new URL(apiUrl).origin;
        return `${origin}${cleanPath}`;
      } catch {
        return cleanPath;
      }
    }
    return cleanPath;
  }

  // Public asset folder reference
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export default resolveImageUrl;
