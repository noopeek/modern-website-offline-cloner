<div align="center">

# noocloner

**Clone modern websites for offline use — Next.js, React, SPA and beyond.**

[![Node](https://img.shields.io/badge/node-20%2B-grey?style=flat-square&labelColor=111)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-grey?style=flat-square&labelColor=111)](LICENSE)
[![Status](https://img.shields.io/badge/status-stable-grey?style=flat-square&labelColor=111)](#)

</div>

---

noocloner is a CLI toolkit for creating faithful offline mirrors of modern websites. It combines `wget` for static asset crawling, Puppeteer with stealth mode for JavaScript-rendered pages, and a local Python HTTP server for previewing the result — all in one workflow.

Designed for sites that break with vanilla `wget --mirror`: SPAs, Next.js apps, React frontends, and pages behind soft bot-detection.

---

## Requirements

- Node.js ≥ 20
- Python 3
- wget
- Chromium (installed automatically by Puppeteer)

---

## Installation

```bash
git clone https://github.com/noopeek/modern-website-offline-cloner.git
cd modern-website-offline-cloner
npm install
```

---

## Quick start

```bash
# full pipeline: crawl → render JS → fetch assets → serve
npm run full

# or run each step individually
npm run clone    # wget crawl
npm run render   # Puppeteer JS rendering
npm run assets   # fetch remaining assets
npm run serve    # local HTTP server on port 8000
```

---

## Configuration

**urls.txt** — list of URLs to clone (one per line)

```
https://example.com
https://example.com/about
https://example.com/blog
```

See `urls.txt.example` for reference.

**cookies.txt** — optional Netscape-format cookies for authenticated pages

```
# Netscape HTTP Cookie File
.example.com  TRUE  /  FALSE  0  session_id  abc123
```

See `cookies.txt.example` for reference.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| Full pipeline | `npm run full` | Runs all steps in sequence |
| Crawl | `npm run clone` | wget-based static crawl |
| Render | `npm run render` | Puppeteer JS rendering with stealth |
| Assets | `npm run assets` | Fetch missing static assets |
| Serve | `npm run serve` | Local HTTP server on port 8000 |

---

## How it works

1. **Crawl** — `wget` downloads all reachable static resources from the target URLs.
2. **Render** — Puppeteer (with `puppeteer-extra-plugin-stealth`) loads each page in a headless browser, executes JavaScript and saves the final HTML.
3. **Assets** — a second pass fetches any assets referenced in the rendered HTML that wget missed.
4. **Serve** — a Python HTTP server serves the cloned site locally for inspection.

The stealth plugin patches Puppeteer’s fingerprint to reduce detection by bot-protection systems (Cloudflare, Akamai, etc.).

---

## Project structure

```
noocloner/
├── scripts/
│   ├── clone_wget.sh       # step 1: wget crawl
│   ├── render_pages.js     # step 2: Puppeteer rendering
│   ├── fetch_assets.sh     # step 3: asset collection
│   ├── full_clone.sh       # full pipeline runner
│   └── server.py           # local HTTP preview server
├── urls.txt.example        # URL list template
├── cookies.txt.example     # cookies template
└── package.json
```

---

## License

MIT © 2025 [noopeek](https://github.com/noopeek) — see [LICENSE](LICENSE) for details.
