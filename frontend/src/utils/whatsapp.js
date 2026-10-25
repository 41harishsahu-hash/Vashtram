export const DEFAULT_WHATSAPP_NUMBER = '+91 7691841583';

/**
 * Normalizes phone numbers to standard WhatsApp format:
 * - Strips all non-digit characters
 * - Converts 10-digit Indian numbers to 91XXXXXXXXXX
 * - Converts 11-digit numbers starting with 0 to 91XXXXXXXXXX
 */
export const formatWhatsAppNumber = (rawPhone) => {
  if (!rawPhone) return '917691841583';
  const digits = rawPhone.toString().replace(/[^0-9]/g, '');
  if (!digits) return '917691841583';

  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
};

/**
 * Builds a direct wa.me link with clean digits and URL-encoded message
 */
export const buildWhatsAppUrl = (phone, message = '') => {
  const clean = formatWhatsAppNumber(phone || DEFAULT_WHATSAPP_NUMBER);
  const textQuery = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${clean}${textQuery}`;
};
