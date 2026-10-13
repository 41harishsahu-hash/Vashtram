/**
 * VASHTRAM Frontend Browser Smoke Test
 * 
 * Verifies that the React frontend renders correctly in a real Chromium browser,
 * mounts into #root with no uncaught exceptions and zero console errors.
 */

const { chromium } = require('playwright-core');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function runSmokeTest() {
  console.log('======================================================');
  console.log('🧪 RUNNING FRONTEND BROWSER SMOKE TEST');
  console.log('======================================================\n');

  const execPath = findBrowserExecutable();
  if (!execPath) {
    throw new Error('No Chromium/Chrome/Edge browser executable found on system.');
  }
  console.log(`✓ Using browser: ${execPath}`);

  // Check if dev server is up at 5173
  let targetUrl = 'http://localhost:5173';
  let serverProcess = null;

  const isDevRunning = await checkPort(5173);
  if (isDevRunning) {
    console.log(`✓ Detected running frontend dev server at ${targetUrl}`);
  } else {
    // If not running, start client build preview or dev
    console.log('ℹ️ Port 5173 not active. Checking client/dist for preview...');
    const distPath = path.resolve(__dirname, '../client/dist');
    if (!fs.existsSync(distPath)) {
      console.log('Building client for smoke test...');
      const { execSync } = require('child_process');
      execSync('npm.cmd run build', {
        cwd: path.resolve(__dirname, '../client'),
        env: { ...process.env, VITE_SITE_URL: 'https://vastram.in' },
        stdio: 'inherit',
      });
    }

    targetUrl = 'http://localhost:4173';
    console.log(`Starting Vite preview on ${targetUrl}...`);
    serverProcess = spawn('npx.cmd', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      cwd: path.resolve(__dirname, '../client'),
      stdio: 'pipe',
      shell: true,
    });

    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkPort(4173)) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      if (serverProcess) serverProcess.kill();
      throw new Error('Failed to start Vite preview server for smoke testing.');
    }
  }

  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
  });

  const pageErrors = [];
  const consoleErrors = [];

  try {
    const page = await browser.newPage();

    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected backend connection errors if backend is not started
        if (text.includes('Failed to load resource') && text.includes('502')) return;
        if (text.includes('Failed to load resource') && text.includes('404') && text.includes('/api/')) return;
        consoleErrors.push(text);
      }
    });

    // Mock API requests cleanly so smoke test tests the frontend React shell deterministically
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/categories')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, categories: [] }) });
      }
      if (url.includes('/products')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, products: [], total: 0 }) });
      }
      if (url.includes('/settings')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, settings: {} }) });
      }
      if (url.includes('/hero')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, hero: {} }) });
      }
      if (url.includes('/features')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, features: [] }) });
      }
      if (url.includes('/about')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, about: {} }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    console.log(`[1/3] Navigating to ${targetUrl}...`);
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
    if (!response || !response.ok()) {
      throw new Error(`Failed to load page. HTTP status: ${response?.status()}`);
    }
    console.log(`✓ Page loaded with HTTP status: ${response.status()}`);

    console.log('[2/3] Checking React DOM mount and root element...');
    const rootElement = await page.$('#root');
    if (!rootElement) {
      throw new Error('Root element #root not found in document.');
    }

    const rootChildrenCount = await page.evaluate(() => {
      const el = document.getElementById('root');
      return el ? el.children.length : 0;
    });

    const rootHtmlLength = await page.evaluate(() => {
      const el = document.getElementById('root');
      return el ? el.innerHTML.length : 0;
    });

    if (rootChildrenCount === 0 || rootHtmlLength < 100) {
      throw new Error(`React failed to mount: #root has ${rootChildrenCount} children and ${rootHtmlLength} HTML characters.`);
    }
    console.log(`✓ React successfully mounted: #root rendered ${rootHtmlLength} chars, ${rootChildrenCount} top-level nodes.`);

    console.log('[3/3] Testing storefront routes for runtime crashes...');
    const testRoutes = ['/shop', '/categories', '/cart', '/checkout', '/about', '/contact'];
    for (const route of testRoutes) {
      await page.goto(`${targetUrl}${route}`, { waitUntil: 'networkidle', timeout: 10000 });
      const mounted = await page.evaluate(() => (document.getElementById('root')?.innerHTML.length || 0) > 100);
      if (!mounted) {
        throw new Error(`Route ${route} failed to render.`);
      }
    }
    console.log(`✓ Tested ${testRoutes.length} storefront routes successfully.`);

    if (pageErrors.length > 0) {
      console.error('❌ Uncaught browser exceptions detected:');
      pageErrors.forEach((e) => console.error(`   - ${e}`));
      throw new Error(`Encountered ${pageErrors.length} uncaught browser page exceptions.`);
    }
    console.log('✓ Zero uncaught page exceptions.');

    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected:');
      consoleErrors.forEach((e) => console.error(`   - ${e}`));
      throw new Error(`Encountered ${consoleErrors.length} console errors.`);
    }
    console.log('✓ Zero console errors.');

    console.log('\n======================================================');
    console.log('✅ FRONTEND SMOKE TEST PASSED');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

if (require.main === module) {
  runSmokeTest().catch((err) => {
    console.error('\n❌ SMOKE TEST FAILED:', err.message);
    process.exit(1);
  });
}

module.exports = { runSmokeTest };
