/**
 * Sanitizes redirect URL to prevent Open Redirect vulnerabilities.
 * Only internal relative paths starting with a single '/' are allowed.
 * Protocol-relative ('//'), backslashes ('\'), schemes ('https:', 'javascript:', 'data:') are rejected.
 *
 * @param {string} url - Target redirect URL candidate
 * @param {string} fallback - Safe fallback destination (defaults to '/')
 * @returns {string} Sanitized internal path or fallback
 */
export const sanitizeRedirectUrl = (url, fallback = '/') => {
  if (!url || typeof url !== 'string') {
    return fallback;
  }
  const trimmed = url.trim();

  // 1. Must start with a single '/'
  // 2. Must NOT start with '//' (protocol-relative external redirect)
  // 3. Must NOT contain backslashes '\' (browser path normalization bypass)
  // 4. Must NOT contain URI scheme / protocol (e.g., https:, javascript:, data:)
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return fallback;
  }

  return trimmed;
};

export default sanitizeRedirectUrl;
