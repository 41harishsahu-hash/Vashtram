/**
 * Validation utilities for Vastram form inputs
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
export const PINCODE_REGEX = /^\d{6}$/;

/**
 * Validates email address format
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
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
