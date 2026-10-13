/**
 * VASHTRAM Password Policy Utility
 *
 * Requirements:
 * - Minimum 8 characters, maximum 128 characters.
 * - Requires a mix of letters and numbers.
 * - Rejects common / dictionary passwords (e.g. password123, 12345678, admin123).
 * - Never trims or alters passwords; evaluates the raw password string.
 */

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'admin123',
  'admin1234',
  'vashtram',
  'vashtram123',
  'vastram123',
  'qwerty123',
  'letmein123',
  'welcome123',
  'iloveyou123',
  'abc12345',
  'pass1234',
  'changeme123',
]);

const validatePasswordPolicy = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      message: 'Password is required and must be a valid string',
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      message: 'Password cannot exceed 128 characters',
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      valid: false,
      message: 'Password must contain a mix of letters and numbers',
    };
  }

  const normalized = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      message: 'Password is too common and easily guessed. Please choose a stronger password',
    };
  }

  return { valid: true };
};

module.exports = {
  validatePasswordPolicy,
  COMMON_PASSWORDS,
};
