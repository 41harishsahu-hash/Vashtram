/**
 * Canonical localStorage management for VASHTRAM.
 * Migrates legacy vastram_* keys to canonical vashtram_* keys on startup and deletes old keys.
 */
const CANONICAL_KEYS = {
  TOKEN: 'vashtram_token',
  USER: 'vashtram_user',
  CART: 'vashtram_cart',
  THEME: 'vashtram_theme',
  PENDING_PAYMENT: 'vashtram_pending_payment',
};

const LEGACY_KEYS = {
  TOKEN: 'vastram_token',
  USER: 'vastram_user',
  CART: 'vastram_cart',
  THEME: 'vastram_theme',
  PENDING_PAYMENT: 'vastram_pending_payment',
};

// Migrate legacy keys on module load
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    Object.keys(CANONICAL_KEYS).forEach((k) => {
      const canonical = CANONICAL_KEYS[k];
      const legacy = LEGACY_KEYS[k];
      const legacyVal = window.localStorage.getItem(legacy);
      if (legacyVal !== null) {
        if (window.localStorage.getItem(canonical) === null) {
          window.localStorage.setItem(canonical, legacyVal);
        }
        window.localStorage.removeItem(legacy);
      }
    });
  }
} catch (e) {
  console.warn('Failed to migrate legacy storage keys:', e);
}

export const storage = {
  getToken: () => {
    try {
      return localStorage.getItem(CANONICAL_KEYS.TOKEN);
    } catch {
      return null;
    }
  },
  setToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(CANONICAL_KEYS.TOKEN, token);
      } else {
        localStorage.removeItem(CANONICAL_KEYS.TOKEN);
      }
    } catch {}
  },
  removeToken: () => {
    try {
      localStorage.removeItem(CANONICAL_KEYS.TOKEN);
      localStorage.removeItem(LEGACY_KEYS.TOKEN);
    } catch {}
  },

  getUser: () => {
    try {
      const val = localStorage.getItem(CANONICAL_KEYS.USER);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem(CANONICAL_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(CANONICAL_KEYS.USER);
      }
    } catch {}
  },
  removeUser: () => {
    try {
      localStorage.removeItem(CANONICAL_KEYS.USER);
      localStorage.removeItem(LEGACY_KEYS.USER);
    } catch {}
  },

  getCart: () => {
    try {
      const val = localStorage.getItem(CANONICAL_KEYS.CART);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  },
  setCart: (cart) => {
    try {
      localStorage.setItem(CANONICAL_KEYS.CART, JSON.stringify(cart));
    } catch {}
  },
  clearCart: () => {
    try {
      localStorage.removeItem(CANONICAL_KEYS.CART);
      localStorage.removeItem(LEGACY_KEYS.CART);
    } catch {}
  },

  getTheme: () => {
    try {
      return localStorage.getItem(CANONICAL_KEYS.THEME) || 'light';
    } catch {
      return 'light';
    }
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(CANONICAL_KEYS.THEME, theme);
    } catch {}
  },

  clearAuth: () => {
    try {
      localStorage.removeItem(CANONICAL_KEYS.TOKEN);
      localStorage.removeItem(LEGACY_KEYS.TOKEN);
      localStorage.removeItem(CANONICAL_KEYS.USER);
      localStorage.removeItem(LEGACY_KEYS.USER);
    } catch {}
  },

  getPendingPayment: () => {
    try {
      const val = localStorage.getItem(CANONICAL_KEYS.PENDING_PAYMENT);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },
  setPendingPayment: (data) => {
    try {
      if (data) {
        localStorage.setItem(CANONICAL_KEYS.PENDING_PAYMENT, JSON.stringify(data));
      } else {
        localStorage.removeItem(CANONICAL_KEYS.PENDING_PAYMENT);
      }
    } catch {}
  },
  clearPendingPayment: () => {
    try {
      localStorage.removeItem(CANONICAL_KEYS.PENDING_PAYMENT);
      localStorage.removeItem(LEGACY_KEYS.PENDING_PAYMENT);
    } catch {}
  },
};

export default storage;
