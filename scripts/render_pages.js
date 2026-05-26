#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = process.env.BASE_URL || 'https://www.site-exemplo.com';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(__dirname, '..', 'site-clonado');
const COOKIES_FILE = process.env.COOKIES_FILE || path.resolve(__dirname, '..', 'cookies.txt');

const DEFAULT_ROUTES = [
  '/',
  '/biblioteca',
  '/configuracoes',
  '/fundador',
  '/mcp',
  '/testegratis',
  '/agents',
  '/academy',
];

const ROUTES = (process.env.ROUTES || DEFAULT_ROUTES.join(',')).split(',').map((r) => r.trim()).filter(Boolean);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function guessExtensionFromContentType(contentType) {
  if (!contentType) return '';
  const ct = contentType.split(';')[0].trim().toLowerCase();

  if (ct === 'text/css') return '.css';
  if (ct === 'application/javascript' || ct === 'text/javascript') return '.js';
  if (ct.startsWith('image/')) {
    const subtype = ct.split('/')[1];
    if (subtype === 'jpeg') return '.jpg';
    return `.${subtype}`;
  }
  if (ct.startsWith('font/')) return '.woff2';
  if (ct === 'application/font-woff') return '.woff';
  if (ct === 'application/json') return '.json';
  return '';
}

function urlToAssetPath(resourceUrl, contentType) {
  const u = new URL(resourceUrl);
  const host = u.hostname;

  let pathname = u.pathname;
  if (!pathname || pathname === '/') {
    pathname = '/root';
  }

  if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const segments = pathname.split('/').filter(Boolean);
  let filename = segments.pop() || 'index';

  const hasExtension = filename.includes('.');
  if (!hasExtension) {
    const ext = guessExtensionFromContentType(contentType);
    filename = filename + ext;
  }

  const assetBaseDir = path.join(OUTPUT_DIR, '_assets_from_puppeteer', host);
  const dir = path.join(assetBaseDir, ...segments);
  ensureDir(dir);
  return path.join(dir, filename);
}

function routeToFilePath(route) {
  let rel = route.trim();

  if (!rel.startsWith('/')) {
    rel = '/' + rel;
  }

  if (rel === '/') {
    return path.join(OUTPUT_DIR, 'index.html');
  }

  const parsed = new URL('http://dummy' + rel);
  const cleanPath = parsed.pathname || '/';
  const segments = cleanPath.split('/').filter(Boolean);
  const dir = path.join(OUTPUT_DIR, ...segments);
  ensureDir(dir);
  return path.join(dir, 'index.html');
}

function parseNetscapeCookies(filePath, baseUrl) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const cookies = [];

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const [domain, flag, pathVal, secure, expiration, name, value] = parts;

    cookies.push({
      domain: domain.trim().startsWith('.') ? domain.trim() : new URL(baseUrl).hostname,
      path: pathVal.trim() || '/',
      name: name.trim(),
      value: value.trim(),
      httpOnly: false,
      secure: secure.toUpperCase() === 'TRUE',
    });
  }

  return cookies;
}

async function applyCookies(page, cookies) {
  if (!cookies.length) return;
  await page.setCookie(...cookies);
}

async function main() {
  console.log('[render_pages] Iniciando renderização com Puppeteer...');
  ensureDir(OUTPUT_DIR);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = parseNetscapeCookies(COOKIES_FILE, BASE_URL);
      console.log(`[render_pages] Aplicando ${cookies.length} cookies...`);
      await applyCookies(page, cookies);
    } else {
      console.warn(`[render_pages] Aviso: COOKIES_FILE não encontrado em ${COOKIES_FILE}`);
    }

    page.on('response', async (response) => {
      try {
        const url = response.url();
        const headers = response.headers();
        const contentType = headers['content-type'] || '';

        if (contentType.startsWith('text/html')) {
          return;
        }

        const isAsset =
          contentType.startsWith('image/') ||
          contentType.startsWith('font/') ||
          contentType === 'text/css' ||
          contentType === 'application/javascript' ||
          contentType === 'text/javascript' ||
          contentType === 'application/json';

        if (!isAsset) return;

        const buffer = await response.buffer().catch(() => null);
        if (!buffer || !buffer.length) return;

        const filePath = urlToAssetPath(url, contentType);
        if (!filePath) return;

        if (fs.existsSync(filePath)) return;

        fs.writeFileSync(filePath, buffer);
      } catch (err) {
        console.warn('[render_pages] Erro ao salvar asset:', err.message);
      }
    });

    for (const route of ROUTES) {
      const targetUrl = new URL(route, BASE_URL).toString();
      console.log(`[render_pages] Navegando para ${targetUrl}`);

      try {
        await page.goto(targetUrl, {
          waitUntil: 'networkidle2',
          timeout: 120000,
        });

        await page.waitForTimeout(2000);

        const html = await page.content();
        const outPath = routeToFilePath(route);
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, html, 'utf8');

        console.log(`[render_pages] HTML salvo em ${outPath}`);
      } catch (err) {
        console.error(`[render_pages] Falha ao renderizar rota ${route}:`, err.message);
      }
    }

    console.log('[render_pages] Renderização concluída.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[render_pages] Erro fatal:', err);
  process.exit(1);
});
