import { useContext } from 'react';
import { SettingsContext } from './settingsContextDef';
import { DEFAULT_WHATSAPP_NUMBER, formatWhatsAppNumber, buildWhatsAppUrl } from '../utils/whatsapp';

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    // Graceful fallback if called outside provider
    return {
      settings: {
        storeName: 'VASHTRAM Mattress Protectors',
        supportEmail: 'vashtramclothsy.info@gmail.com',
        supportPhone: '+91 7691841583',
        whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
        storeAddress: 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
      },
      storeName: 'VASHTRAM Mattress Protectors',
      whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
      supportEmail: 'vashtramclothsy.info@gmail.com',
      supportPhone: '+91 7691841583',
      storeAddress: 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
      cleanWhatsAppNumber: '917691841583',
      getWhatsAppUrl: (msg = '') => buildWhatsAppUrl(DEFAULT_WHATSAPP_NUMBER, msg),
      formatWhatsAppNumber,
      updateLocalSettings: () => {},
      refreshSettings: () => Promise.resolve(),
      loading: false,
    };
  }
  return context;
};

export default useSettings;
