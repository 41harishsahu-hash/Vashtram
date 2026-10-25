/**
 * Escapes regex special characters to prevent ReDoS, regex syntax errors, or crashes
 * from user input like '(', '[', '\', '*', '+', '?', '.'
 */
const escapeRegex = (string) => {
  if (typeof string !== 'string') return '';
  return string.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Safely creates a RegExp instance from user input (substring match)
 */
const createSafeRegex = (string, flags = 'i') => {
  const escaped = escapeRegex(string);
  return escaped ? new RegExp(escaped, flags) : null;
};

/**
 * Safely creates an exact-match RegExp instance from user input (^...$)
 * Anchors are added AFTER escaping so ^ and $ are never escaped as literals.
 */
const createExactRegex = (string, flags = 'i') => {
  const escaped = escapeRegex(string);
  return escaped ? new RegExp(`^${escaped}$`, flags) : null;
};

module.exports = {
  escapeRegex,
  createSafeRegex,
  createExactRegex,
};
