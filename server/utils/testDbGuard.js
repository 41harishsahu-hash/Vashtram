/**
 * Shared Test Database Safety Guard
 * 
 * Protects production databases from accidental corruption by test runners.
 * Refuses execution if:
 * 1. Target URI host equals production MONGODB_URI host.
 * 2. Target URI is not pointing to an authorized isolated test host (localhost / 127.0.0.1 / MONGODB_TEST_URI / in-memory).
 */

function extractHost(uri) {
  if (!uri || typeof uri !== 'string') return '';
  try {
    // Handle standard mongodb:// or mongodb+srv://
    const cleaned = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const withoutCreds = cleaned.includes('@') ? cleaned.split('@')[1] : cleaned;
    const hostPort = withoutCreds.split('/')[0].split('?')[0];
    return hostPort.toLowerCase();
  } catch {
    return '';
  }
}

function assertSafeTestDatabase(targetUri) {
  const prodUri = process.env.MONGODB_URI || '';
  const prodHost = extractHost(prodUri);
  const targetHost = extractHost(targetUri);

  // If no target URI provided, it cannot run safely
  if (!targetUri || typeof targetUri !== 'string') {
    const errorMsg = '❌ FATAL SAFETY ERROR: No database URI provided to testDbGuard.';
    console.error(`\n${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  // Guard 1: Direct match against production URI
  if (prodUri && targetUri.trim() === prodUri.trim()) {
    const errorMsg = '❌ FATAL SAFETY ERROR: Test database URI exactly matches production MONGODB_URI!';
    console.error(`\n${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  // Guard 2: Host matches production Atlas cluster host
  if (prodHost && targetHost && targetHost === prodHost) {
    const errorMsg = `❌ FATAL SAFETY ERROR: Test target host (${targetHost}) equals production MONGODB_URI host (${prodHost})!`;
    console.error(`\n${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  // Guard 3: Specifically detect any Atlas cluster strings
  if (targetHost.includes('mongodb.net') || targetHost.includes('cluster0')) {
    const errorMsg = `❌ FATAL SAFETY ERROR: Test database points to remote Atlas cluster (${targetHost})!`;
    console.error(`\n${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  // Guard 4: Must be localhost, 127.0.0.1, in-memory, or explicitly authorized MONGODB_TEST_URI
  const testEnvUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI_TEST || '';
  const isLocalhost = targetHost.includes('localhost') || targetHost.includes('127.0.0.1');
  const isExplicitTestUri = testEnvUri && targetUri.trim() === testEnvUri.trim();

  if (!isLocalhost && !isExplicitTestUri) {
    const errorMsg = `❌ FATAL SAFETY ERROR: Test target host (${targetHost}) is not localhost, 127.0.0.1, or configured MONGODB_TEST_URI.`;
    console.error(`\n${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  return true;
}

module.exports = { assertSafeTestDatabase, extractHost };
