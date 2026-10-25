import React, { useState, useEffect, useCallback } from 'react';
import api, { setOnUnauthorizedCallback } from '../services/api';
import { AuthContext } from './authContextDef';
import { storage } from '../utils/storage';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => storage.getUser());
  const [token, setToken] = useState(() => storage.getToken());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    storage.clearAuth();
  }, []);

  // Synchronize React auth state when Axios receives 401 on an authenticated request
  useEffect(() => {
    // 1. Direct callback registration from axios interceptor
    setOnUnauthorizedCallback(() => {
      logout();
    });

    // 2. Custom window events dispatched by api.js
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('vashtram:auth-expired', handleAuthExpired);
    window.addEventListener('vashtram:auth:unauthorized', handleAuthExpired);

    return () => {
      setOnUnauthorizedCallback(null);
      window.removeEventListener('vashtram:auth-expired', handleAuthExpired);
      window.removeEventListener('vashtram:auth:unauthorized', handleAuthExpired);
    };
  }, [logout]);

  // Sync state and check validity on mount
  useEffect(() => {
    let isMounted = true;
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (isMounted && res.data?.success && res.data?.user) {
            setUser(res.data.user);
            storage.setUser(res.data.user);
          }
        })
        .catch((err) => {
          if (isMounted) {
            const status = err?.status || err?.response?.status;
            // Failure must log user out ONLY on 401 or 403. Network errors and 429 keep the session.
            if (status === 401 || status === 403) {
              logout();
            }
          }
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    } else {
      const timer = setTimeout(() => {
        if (isMounted) {
          setLoading(false);
        }
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [token, logout]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.success) {
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);
      storage.setToken(receivedToken);
      storage.setUser(receivedUser);
      return res.data;
    }
    throw new Error(res.data?.message || 'Login failed');
  };

  const adminLogin = async (email, password) => {
    let res;
    try {
      res = await api.post('/admin/login', { email, password });
    } catch (err) {
      // Fallback to /auth/login only if /admin/login route is completely missing (404)
      if (err.status === 404) {
        res = await api.post('/auth/login', { email, password });
      } else {
        throw err;
      }
    }
    if (res.data?.success) {
      if (res.data.user?.role !== 'admin') {
        throw new Error('Access denied: You do not have administrator permissions.');
      }
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);
      storage.setToken(receivedToken);
      storage.setUser(receivedUser);
      return res.data;
    }
    throw new Error(res.data?.message || 'Admin login failed');
  };

  const register = async (name, email, password, phone) => {
    const res = await api.post('/auth/register', { name, email, password, phone });
    if (res.data?.success) {
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);
      storage.setToken(receivedToken);
      storage.setUser(receivedUser);
      return res.data;
    }
    throw new Error(res.data?.message || 'Registration failed');
  };

  const updateProfile = async (updateData) => {
    const res = await api.put('/auth/profile', updateData);
    if (res.data?.success && res.data?.user) {
      // Persist new JWT token if returned (e.g. password change)
      if (res.data.token) {
        setToken(res.data.token);
        storage.setToken(res.data.token);
      }
      setUser(res.data.user);
      storage.setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data?.message || 'Profile update failed');
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = isAuthenticated && user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        login,
        adminLogin,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
