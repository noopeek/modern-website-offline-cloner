#!/usr/bin/env node

/**
 * Renderiza rotas com Puppeteer (+ puppeteer-extra + stealth) e salva HTML final
 * como index.html em subpastas, além de capturar assets não-HTML em arquivos.
 *
 * Compatível com Puppeteer v20+ (inclui v22+ onde buffer() e waitForTimeout() foram removidos).
 */

const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = process.env.BASE_URL || 'https://www.site-exemplo.com';
const OUTPUT_DIR =
  process.env.OUTPUT_DIR || path.resolve(__dirname, '..', 'site-clonado');
const COOKIES_FILE =
  process.env.COOKIES_FILE || path.resolve(__dirname, '..', 'cookies.txt');

// Rotas padrão (passe ROUTES=... env para sobrescrever)
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

const ROUTES = (process.env.ROUTES || DEFAULT_ROUTES.join(','))
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** Aguarda N ms sem depender de page.waitForTimeout (removido no Puppeteer v22+). */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // Sanitiza segmentos: remove '..' e '.' para evitar path traversal
  const segments = pathname
    .split('/')
    .filter((s) => s && s !== '..' && s !== '.');

  let filename = segments.pop() || 'index';

  const hasExtension = filename.includes('.');
  if (!hasExtension) {
    let ext = guessExtensionFromContentType(contentType);
    if (!ext) {
      ext = path.extname(u.pathname) || '';
    }
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
  const segments = cleanPath
    .split('/')
    .filter((s) => s && s !== '..' && s !== '.');
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

    const [domain, , pathVal, secure, , name, value] = parts;

    cookies.push({
      domain: domain.trim().startsWith('.')
        ? domain.trim()
        : new URL(baseUrl).hostname,
      path: pathVal.trim() || '/',
      name: name.trim(),
      value: value.trim(),
      httpOnly: false,
      secure: secure.toUpperCase() === 'TRUE',
    });
  }

  return cookies;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[render_pages] Iniciando renderização com Puppeteer...');
  ensureDir(OUTPUT_DIR);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // Aplica cookies no contexto padrão do browser (antes de qualquer navegação)
    // para garantir que estejam disponíveis desde a primeira requisição.
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = parseNetscapeCookies(COOKIES_FILE, BASE_URL);
      console.log(
        `[render_pages] Aplicando ${cookies.length} cookies no contexto do browser...`,
      );
      const context = browser.defaultBrowserContext();
      await context.setCookie(...cookies);
    } else {
      console.warn(
        `[render_pages] Aviso: COOKIES_FILE não encontrado em ${COOKIES_FILE}`,
      );
    }

    const page = await browser.newPage();

    // Set de deduplicação: evita race condition quando o mesmo asset
    // é solicitado múltiplas vezes (redirect, retry, prefetch do Next.js)
    const savedAssets = new Set();

    page.on('response', async (response) => {
      try {
        const url = response.url();

        // Ignora URLs já processadas (checagem em memória, sem I/O)
        if (savedAssets.has(url)) return;

        const headers = response.headers();
        const contentType = headers['content-type'] || '';

        // Páginas HTML são tratadas diretamente no loop de rotas
        if (contentType.startsWith('text/html')) return;

        const isAsset =
          contentType.startsWith('image/') ||
          contentType.startsWith('font/') ||
          contentType === 'text/css' ||
          contentType === 'application/javascript' ||
          contentType === 'text/javascript' ||
          contentType === 'application/json';

        if (!isAsset) return;

        // Marca como processada antes do await para evitar concorrência
        savedAssets.add(url);

        // response.bytes() substitui response.buffer() no Puppeteer v22+
        const buffer = await response.bytes().catch(() => null);
        if (!buffer || !buffer.length) return;

        const filePath = urlToAssetPath(url, contentType);
        if (!filePath) return;

        // Não sobrescreve assets já presentes em disco (capturados pelo wget)
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
        // domcontentloaded é mais robusto que networkidle2 em SPAs com
        // polling, WebSockets ou conexões persistentes (que nunca atingem idle)
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });

        // Tenta aguardar o elemento principal do app; fallback temporal se não existir
        await page
          .waitForSelector('main, #__next, #app, [data-reactroot]', {
            timeout: 10000,
          })
          .catch(() => {});

        // Aguarda 2s extra para lazy hydration e chunks assíncronos do Next.js
        await wait(2000);

        const html = await page.content();
        const outPath = routeToFilePath(route);
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, html, 'utf8');

        console.log(`[render_pages] ✓ HTML salvo em ${outPath}`);
      } catch (err) {
        console.error(
          `[render_pages] ✗ Falha ao renderizar rota ${route}:`,
          err.message,
        );
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
