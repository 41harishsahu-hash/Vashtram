/**
 * Determines whether a given request URL is a public authentication entrypoint
 * (login, register, admin login). 401 responses on these endpoints represent invalid credentials,
 * NOT expired sessions, and must never trigger automatic session invalidation or redirects.
 *
 * @param {string} url - Candidate request URL or path
 * @returns {boolean} True if the endpoint is an auth entrypoint
 */
export const isAuthEntrypoint = (url) => {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    cleanUrl.endsWith('/auth/login') ||
    cleanUrl.endsWith('/admin/login') ||
    cleanUrl.endsWith('/auth/register') ||
    cleanUrl.includes('/auth/login') ||
    cleanUrl.includes('/admin/login') ||
    cleanUrl.includes('/auth/register') ||
    /(?:^|\/)(login|register)$/.test(cleanUrl)
  );
};

export default isAuthEntrypoint;
