/**
 * Validation utilities for Vastram form inputs
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
export const PINCODE_REGEX = /^\d{6}$/;

/**
 * Validates full name: 2-60 chars, letters, spaces, apostrophes, periods, hyphens
 */
export const isValidFullName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return true;
};

/**
 * Validates email address format with practical RFC 5321/5322 rules (max 254 chars, no consecutive dots)
 */
export const isValidEmailAddress = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.includes('..')) return false;

  const atIndex = trimmed.indexOf('@');
  const lastAtIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== lastAtIndex || atIndex === trimmed.length - 1) {
    return false;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.')) {
    return false;
  }
  if (!/^[a-zA-Z0-9._%+-]+$/.test(localPart)) {
    return false;
  }

  if (domainPart.length > 253 || domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.startsWith('-') || domainPart.endsWith('-')) {
    return false;
  }
  const domainLabels = domainPart.split('.');
  if (domainLabels.length < 2) {
    return false;
  }

  for (const label of domainLabels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
  }

  const tld = domainLabels[domainLabels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) {
    return false;
  }

  return true;
};

/**
 * Validates email address format
 */
export const isValidEmail = (email) => {
  return isValidEmailAddress(email);
};

/**
 * Validates street address: 5-200 chars, supports Indian addresses with letters, numbers,
 * spaces, commas, periods, hyphens, slashes, apostrophes, #
 */
export const isValidStreetAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed.length < 5 || trimmed.length > 200) return false;
  if (!/^[a-zA-Z0-9\s,.'#/\-:&()]+$/.test(trimmed)) return false;
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphanumericCount < 3) return false;
  return true;
};

/**
 * Validates state: 2-60 chars, letters, spaces, periods, hyphens
 */
export const isValidState = (state) => {
  if (!state || typeof state !== 'string') return false;
  const trimmed = state.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if (!/^[a-zA-Z\s.-]+$/.test(trimmed)) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return true;
};

/**
 * Validates city: 2-60 chars, letters, spaces, periods, apostrophes, hyphens
 */
export const isValidCity = (city) => {
  if (!city || typeof city !== 'string') return false;
  const trimmed = city.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return true;
};

/**
 * Validates optional special delivery instructions: max 250 chars, letters, numbers,
 * spaces, and normal punctuation. Must contain alphanumeric content if provided.
 */
export const isValidDeliveryNotes = (notes) => {
  if (notes === undefined || notes === null) return true;
  if (typeof notes !== 'string') return false;
  const trimmed = notes.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > 250) return false;
  if (!/[a-zA-Z0-9]/.test(trimmed)) return false;
  if (!/^[a-zA-Z0-9\s,.'#/\-:&()!?"+@;%*_]+$/.test(trimmed)) return false;
  return true;
};

/**
 * Validates 10-digit Indian mobile number (optionally with leading +91 or 0 stripped)
 */
export const isValidMobile = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  // If formatted as 919876543210 (12 digits), strip 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return INDIAN_MOBILE_REGEX.test(cleaned.slice(2));
  }
  // If formatted as 09876543210 (11 digits), strip 0
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return INDIAN_MOBILE_REGEX.test(cleaned.slice(1));
  }
  return INDIAN_MOBILE_REGEX.test(cleaned);
};

/**
 * Validates Indian 6-digit postal pincode
 */
export const isValidPincode = (pincode) => {
  if (!pincode || typeof pincode !== 'string') return false;
  return PINCODE_REGEX.test(pincode.trim());
};

/**
 * Strips non-digit characters for phone fields (max 10 digits)
 */
export const sanitizePhoneInput = (val) => {
  if (!val) return '';
  return val.replace(/\D/g, '').slice(0, 10);
};

/**
 * Strips non-digit characters for pincode fields (max 6 digits)
 */
export const sanitizePincodeInput = (val) => {
  if (!val) return '';
  return val.replace(/\D/g, '').slice(0, 6);
};

/**
 * Validates Contact Us form fields
 */
export const validateContactForm = (formData) => {
  const errors = {};

  // Name validation
  const name = (formData.name || '').trim();
  if (!name) {
    errors.name = 'Please enter your name';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (name.length > 50) {
    errors.name = 'Name cannot exceed 50 characters';
  }

  // Email validation
  const email = (formData.email || '').trim();
  if (!email) {
    errors.email = 'Please enter your email address';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address (e.g. name@example.com)';
  }

  // Phone validation (optional, but if filled must be valid)
  const phone = (formData.phone || '').trim();
  if (phone) {
    const cleanedDigits = phone.replace(/\D/g, '');
    if (cleanedDigits.length < 10) {
      errors.phone = 'Phone number must be at least 10 digits';
    } else if (!isValidMobile(phone)) {
      errors.phone = 'Please enter a valid 10-digit mobile number starting with 6-9';
    }
  }

  // Subject validation
  const subject = (formData.subject || '').trim();
  if (!subject) {
    errors.subject = 'Please enter an inquiry subject';
  } else if (subject.length < 3) {
    errors.subject = 'Subject must be at least 3 characters';
  } else if (subject.length > 150) {
    errors.subject = 'Subject cannot exceed 150 characters';
  }

  // Message validation
  const message = (formData.message || '').trim();
  if (!message) {
    errors.message = 'Please enter your message';
  } else if (message.length < 10) {
    errors.message = 'Message must be at least 10 characters so we can assist you better';
  } else if (message.length > 3000) {
    errors.message = 'Message cannot exceed 3000 characters';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

/**
 * Validates My Account / Profile & Address form fields
 */
export const validateAccountForm = (formData) => {
  const errors = {};

  // Profile Name validation
  const name = (formData.name || '').trim();
  if (!name) {
    errors.name = 'Please enter your full name';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (name.length > 60) {
    errors.name = 'Name cannot exceed 60 characters';
  }

  // Contact Phone validation (optional)
  const phone = (formData.phone || '').trim();
  if (phone) {
    if (!isValidMobile(phone)) {
      errors.phone = 'Please enter a valid 10-digit mobile number starting with 6-9';
    }
  }

  // Address Section validations:
  // If user has started entering an address, validate all address fields
  const hasStartedAddress =
    Boolean(formData.fullName?.trim()) ||
    Boolean(formData.mobileNumber?.trim()) ||
    Boolean(formData.address?.trim()) ||
    Boolean(formData.city?.trim()) ||
    Boolean(formData.pincode?.trim());

  if (hasStartedAddress) {
    const fullName = (formData.fullName || '').trim();
    if (!fullName) {
      errors.fullName = 'Recipient name is required for delivery';
    } else if (fullName.length < 2) {
      errors.fullName = 'Recipient name must be at least 2 characters';
    } else if (fullName.length > 60) {
      errors.fullName = 'Recipient name cannot exceed 60 characters';
    }

    const mobileNumber = (formData.mobileNumber || '').trim();
    if (!mobileNumber) {
      errors.mobileNumber = 'Recipient mobile number is required';
    } else if (!isValidMobile(mobileNumber)) {
      errors.mobileNumber = 'Please enter a valid 10-digit mobile number starting with 6-9';
    }

    const address = (formData.address || '').trim();
    if (!address) {
      errors.address = 'Street/Flat address is required';
    } else if (address.length < 5) {
      errors.address = 'Please enter a detailed delivery address (min 5 characters)';
    } else if (address.length > 250) {
      errors.address = 'Address cannot exceed 250 characters';
    }

    const city = (formData.city || '').trim();
    if (!city) {
      errors.city = 'City is required';
    } else if (city.length < 2) {
      errors.city = 'City name must be at least 2 characters';
    }

    const state = (formData.state || '').trim();
    if (!state) {
      errors.state = 'State is required';
    }

    const pincode = (formData.pincode || '').trim();
    if (!pincode) {
      errors.pincode = 'Pincode is required';
    } else if (!isValidPincode(pincode)) {
      errors.pincode = 'Please enter a valid 6-digit postal pincode';
    }
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};
