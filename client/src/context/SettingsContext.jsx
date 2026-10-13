import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  DEFAULT_WHATSAPP_NUMBER,
  formatWhatsAppNumber,
  buildWhatsAppUrl,
} from '../utils/whatsapp';
import { SettingsContext } from './settingsContextDef';

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    storeName: 'VASHTRAM Mattress Protectors',
    supportEmail: 'vashtramclothsy.info@gmail.com',
    supportPhone: '+91 7691841583',
    whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
    storeAddress: 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
    currency: 'INR (₹)',
    freeShippingThreshold: 999,
    standardShippingFee: 99,
    enableReturns: true,
    returnDays: 7,
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = () => {
    return api
      .get('/settings')
      .then((res) => {
        if (res.data?.success && res.data?.settings) {
          setSettings((prev) => ({
            ...prev,
            ...res.data.settings,
          }));
        }
      })
      .catch((err) => {
        console.warn('[SettingsContext]: Using fallback settings:', err.message || err);
      });
  };

  useEffect(() => {
    let isMounted = true;
    api
      .get('/settings')
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.settings) {
          setSettings((prev) => ({
            ...prev,
            ...res.data.settings,
          }));
        }
      })
      .catch((err) => {
        console.warn('[SettingsContext]: Using fallback settings:', err.message || err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update in-memory state immediately (useful after Admin saves)
  const updateLocalSettings = (newSettings) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));
  };

  const whatsappNumber = settings.whatsappNumber || DEFAULT_WHATSAPP_NUMBER;
  const cleanWhatsAppNumber = formatWhatsAppNumber(whatsappNumber);

  const getWhatsAppUrl = (message = '', overridePhone = null) => {
    return buildWhatsAppUrl(overridePhone || whatsappNumber, message);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        storeName: settings.storeName || 'VASHTRAM Mattress Protectors',
        whatsappNumber,
        supportEmail: settings.supportEmail || 'vashtramclothsy.info@gmail.com',
        supportPhone: settings.supportPhone || '+91 7691841583',
        storeAddress: settings.storeAddress || 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
        cleanWhatsAppNumber,
        getWhatsAppUrl,
        formatWhatsAppNumber,
        updateLocalSettings,
        refreshSettings: fetchSettings,
        loading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
