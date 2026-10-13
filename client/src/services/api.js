import axios from 'axios';
import { storage } from '../utils/storage';
import { isAuthEntrypoint } from '../utils/authHelper';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Listener callback to synchronize React AuthContext with 401 responses
let onUnauthorizedCallback = null;

export const setOnUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

export { isAuthEntrypoint };

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config;

    // 1. Safe single retry for GET requests only (transient network errors / 502/503/504)
    // Never retry POST/PUT/DELETE, especially payment/order endpoints
    if (
      config &&
      config.method &&
      config.method.toLowerCase() === 'get' &&
      !config._retry &&
      (!error.response || [502, 503, 504].includes(error.response.status))
    ) {
      config._retry = true;
      return api(config);
    }

    // 2. Offline detection
    if (
      typeof window !== 'undefined' &&
      window.navigator &&
      window.navigator.onLine === false
    ) {
      return Promise.reject({
        message: 'You are currently offline. Please check your internet connection.',
        status: 0,
        offline: true,
      });
    }

    // 3. Timeout handling
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return Promise.reject({
        message: 'Request timed out. The server took too long to respond. Please try again.',
        status: 408,
        timeout: true,
      });
    }

    // 4. Handle unauthorized / expired token (401)
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const hasStoredToken = !!storage.getToken();
      const hadAuthHeader = !!(
        error.config?.headers?.Authorization ||
        error.config?.headers?.authorization ||
        hasStoredToken
      );
      const isEntrypoint = isAuthEntrypoint(requestUrl);

      // Only perform session cleanup/synchronization for authenticated requests,
      // not public login/register failures
      if (hadAuthHeader && !isEntrypoint) {
        storage.clearAuth(); // Keeps cart in localStorage intact!

        if (typeof onUnauthorizedCallback === 'function') {
          try {
            onUnauthorizedCallback();
          } catch (cbErr) {
            console.warn('[api interceptor]: onUnauthorizedCallback error:', cbErr);
          }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('vashtram:auth-expired', {
              detail: { url: requestUrl, status: 401 },
            })
          );
          window.dispatchEvent(
            new CustomEvent('vashtram:auth:unauthorized', {
              detail: { url: requestUrl, status: 401 },
            })
          );

          // Redirect to login preserving return-to path with session expired indicator
          const pathname = window.location.pathname;
          if (!pathname.includes('/login')) {
            const returnTo = pathname + window.location.search;
            const targetLogin = pathname.startsWith('/admin')
              ? `/admin/login?redirect=${encodeURIComponent(returnTo)}&sessionExpired=true`
              : `/login?redirect=${encodeURIComponent(returnTo)}&sessionExpired=true`;
            window.location.href = targetLogin;
          }
        }
      }
    }

    // 5. 429 Rate limiting handling
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.['retry-after'];
      const serverMsg = error.response?.data?.message;
      let friendlyMessage = serverMsg || 'Too many requests. Please slow down and try again.';
      if (retryAfter && !friendlyMessage.toLowerCase().includes('after') && !friendlyMessage.toLowerCase().includes('seconds')) {
        friendlyMessage += ` Please try again in ${retryAfter} seconds.`;
      }
      return Promise.reject({
        message: friendlyMessage,
        status: 429,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
        data: error.response?.data,
      });
    }

    // 6. 500 Internal server error handling
    if (error.response?.status >= 500) {
      return Promise.reject({
        message: 'Our service is temporarily unavailable. Please try again shortly.',
        status: error.response.status,
        data: error.response?.data,
      });
    }

    const customError = {
      message:
        error.response?.data?.message ||
        error.message ||
        'Something went wrong with the server. Please try again.',
      status: error.response?.status,
      data: error.response?.data,
    };
    return Promise.reject(customError);
  }
);

export default api;
