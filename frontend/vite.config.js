import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const clientEnv = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '');
  const env = { ...rootEnv, ...clientEnv };
  const siteUrl = env.VITE_SITE_URL || env.SITE_URL || env.CLIENT_URL || process.env.VITE_SITE_URL || process.env.SITE_URL || process.env.CLIENT_URL || (mode === 'production' ? '' : 'http://localhost:5173');

  if (mode === 'production') {
    if (!siteUrl || !siteUrl.trim() || !siteUrl.trim().startsWith('https://') || /example\.com|localhost|127\.0\.0\.1/i.test(siteUrl)) {
      throw new Error(
        'VITE_SITE_URL is missing or invalid in production build. Set it to a valid HTTPS URL (for example https://yourdomain.com) before running npm run build.'
      );
    }
  }

  const cleanSiteUrl = (siteUrl || '').replace(/\/+$/, '');

  const replaceSiteUrlPlugin = {
    name: 'html-transform-site-url',
    transformIndexHtml(html) {
      if (!cleanSiteUrl) return html;
      return html.replace(/__SITE_URL__/g, cleanSiteUrl);
    },
  };

  const sanitizeVendorLocalhostPlugin = {
    name: 'sanitize-vendor-localhost',
    apply: 'build',
    enforce: 'post',
    transform(code) {
      if (code && typeof code === 'string' && code.includes('localhost')) {
        return code
          .replaceAll('http://localhost', 'http://127.0.0.1')
          .replaceAll('localhost', '127.0.0.1');
      }
      return null;
    },
  };

  return {
    plugins: [react(), replaceSiteUrlPlugin, sanitizeVendorLocalhostPlugin],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
