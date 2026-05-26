# modern-website-offline-cloner

Template completo para clonar **front‑ends modernos** (SPA/Next.js/React) protegidos por autenticação (cookies) em um espelho **100% offline**, combinando:

- `wget` para capturar a base estática (HTML bruto, `_next`, CSS, imagens, fontes).
- `Puppeteer` + `puppeteer-extra` + `puppeteer-extra-plugin-stealth` para renderizar JS, salvar `index.html` de rotas dinâmicas e capturar assets que escapam do `wget`.
- Um servidor HTTP Python que corrige MIME types para que as páginas abram normalmente em vez de serem baixadas.

> ⚠️ Use apenas em sites nos quais você tem permissão explícita (seu próprio sistema, ambientes de teste, etc.).

---

## Visão geral da arquitetura

Fluxo padrão:

1. **Clone base com `wget`**  
   Captura tudo o que é facilmente acessível estaticamente (HTML, JS, CSS, imagens, fontes), usando cookies exportados do navegador.

2. **Renderização de rotas com Puppeteer**  
   - Carrega cookies (`cookies.txt`, formato Netscape).
   - Navega por rotas importantes (`/`, `/biblioteca`, `/configuracoes`, `/fundador`, `/mcp`, `/testegratis`, `/agents`, `/academy`).
   - Espera a app carregar (JS incluso) e salva o HTML final em `index.html` dentro de cada pasta de rota.
   - Intercepta respostas e salva assets (JS, CSS, fontes, imagens) como arquivos reais, usando `Content-Type` para não transformar assets em diretórios com `index.html`.

3. **Download de assets restantes (UUIDs, chunks específicos)**  
   - Lista manual de URLs em `urls.txt`.
   - Script `fetch_assets.sh` baixa todos em lote via `wget`.

4. **Servidor local Python**  
   - Serve `./site-clonado`.
   - Força `Content-Type: text/html` para URLs sem extensão, evitando páginas sendo baixadas no navegador.

---

## Ferramentas utilizadas

| Ferramenta | Uso |
|---|---|
| `wget` | Download massivo de assets estáticos (CSS, JS, imagens, fontes) |
| `puppeteer` + `puppeteer-extra` + `puppeteer-extra-plugin-stealth` | Renderização de páginas com JavaScript e menor chance de detecção de bot |
| Node.js (v20+) | Execução dos scripts de renderização |
| Python 3 | Servidor HTTP customizado com MIME type corrigido |
| Extensão **cookies.txt** (Chrome/Firefox) | Exportar cookies em formato Netscape |

---

## Pré‑requisitos

- **Node.js**: v20+
- **npm** ou **pnpm** ou **yarn**
- **Python 3** (3.8+ recomendado)
- **GNU Wget** 1.21+
- Extensão de navegador para exportar cookies (ex.: "cookies.txt")

---

## Instalação

```bash
git clone https://github.com/joaolucasjorge/modern-website-offline-cloner.git
cd modern-website-offline-cloner

npm install
```

---

## 1. Obter cookies

1. Instale a extensão **"cookies.txt"** no Chrome ou Firefox.
2. Faça login no site desejado (ex.: `https://www.site-exemplo.com`).
3. Exporte os cookies do domínio e salve como:

```text
./cookies.txt
```

Use `cookies.txt.example` como referência de formato.

---

## 2. Configurar variáveis

Configure as variáveis de ambiente antes de rodar (ou edite diretamente nos scripts):

```bash
export BASE_URL="https://www.site-exemplo.com/"
export COOKIES_FILE="./cookies.txt"
export OUTPUT_DIR="./site-clonado"
export ROUTES="/,/biblioteca,/configuracoes,/fundador,/mcp,/testegratis,/agents,/academy"
```

---

## 3. Clonar com `wget`

### Comando direto (modo rápido)

```bash
wget --mirror --convert-links --adjust-extension --page-requisites --no-parent \
     --load-cookies ./cookies.txt \
     --wait 2 --random-wait --limit-rate=100k --no-if-modified-since \
     --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
     --execute robots=off \
     "https://www.site-exemplo.com/"
```

### Via script (recomendado)

```bash
npm run clone
# ou
bash scripts/clone_wget.sh
```

O script já inclui:
- `--span-hosts` + `--domains` / `--exclude-domains` para limitar hosts
- Retentativas (`--tries`, `--waitretry`, `--retry-connrefused`)
- Timeouts DNS, conexão e leitura separados
- Log completo em `wget.log` e URLs rejeitadas em `rejected.csv`
- Limite de cota (`--quota=2g`) para evitar explosões

---

## 4. Renderizar páginas com Puppeteer

### Exemplo minimalista (didático)

```javascript
// render simples: 1 browser por rota
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const SITE_URL = 'https://www.site-exemplo.com';
const OUTPUT_DIR = './site-clonado';
const COOKIES_FILE = './cookies.txt';
const ROTAS = ['/', '/biblioteca', '/configuracoes', '/fundador', '/mcp', '/testegratis'];

async function renderizar(rota) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const cookiesTxt = await fs.readFile(COOKIES_FILE, 'utf8');
  const cookies = cookiesTxt
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const parts = l.split('\t');
      return { name: parts[5], value: parts[6], domain: parts[0] };
    });
  await page.setCookie(...cookies);

  const url = SITE_URL + rota;
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.content();

  let htmlPath;
  if (rota === '/') htmlPath = path.join(OUTPUT_DIR, 'index.html');
  else htmlPath = path.join(OUTPUT_DIR, rota.slice(1), 'index.html');

  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await fs.writeFile(htmlPath, html);
  console.log(`Salvo: ${htmlPath}`);
  await browser.close();
}

(async () => {
  for (const rota of ROTAS) await renderizar(rota);
})();
```

### Versão de produção (com stealth + interceptação de assets)

```bash
npm run render
# ou
node scripts/render_pages.js
```

Comportamento:
- Usa `puppeteer-extra` + `puppeteer-extra-plugin-stealth` para menor detecção.
- Reutiliza um único browser para todas as rotas.
- Intercepta respostas e salva assets com extensão correta baseada em `Content-Type`.
- Passa variáveis via env:

```bash
BASE_URL="https://www.site-exemplo.com" \
ROUTES="/,/biblioteca,/configuracoes,/fundador,/mcp,/testegratis,/agents,/academy" \
node scripts/render_pages.js
```

---

## 5. Criar e renderizar rotas adicionais

### Criar pastas manualmente

```bash
mkdir -p site-clonado/agents site-clonado/academy
```

### One‑liner com Node.js

```bash
node -e "
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const cookiesTxt = await fs.readFile('./cookies.txt', 'utf8');
  const cookies = cookiesTxt
    .split('\\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const p = l.split('\\t'); return { name: p[5], value: p[6], domain: p[0] }; });
  await page.setCookie(...cookies);

  await page.goto('https://www.site-exemplo.com/agents', { waitUntil: 'networkidle2' });
  await fs.mkdir('site-clonado/agents', { recursive: true });
  await fs.writeFile('site-clonado/agents/index.html', await page.content());

  await page.goto('https://www.site-exemplo.com/academy', { waitUntil: 'networkidle2' });
  await fs.mkdir('site-clonado/academy', { recursive: true });
  await fs.writeFile('site-clonado/academy/index.html', await page.content());

  await browser.close();
})();
"
```

---

## 6. Baixar assets UUID faltantes

### Criar `urls.txt`

```text
https://www.site-exemplo.com/assets/asset-uuid-1
https://www.site-exemplo.com/assets/asset-uuid-2
https://www.site-exemplo.com/assets/asset-uuid-3
```

### Via loop inline

```bash
while read url; do
  [[ -z "$url" ]] && continue
  [[ "$url" =~ ^# ]] && continue
  wget --load-cookies ./cookies.txt -P ./site-clonado/assets/ "$url"
  sleep 0.5
done < urls.txt
```

### Via script

```bash
npm run assets
# ou
bash scripts/fetch_assets.sh
```

---

## 7. Servidor local (MIME type corrigido)

### Versão simples (pode colocar na raiz do clone)

```python
import http.server, socketserver, posixpath

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        base, ext = posixpath.splitext(path)
        if ext == '':
            return 'text/html'
        return super().guess_type(path)

if __name__ == '__main__':
    PORT = 8000
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Servidor em http://localhost:{PORT}")
        httpd.serve_forever()
```

Execute e acesse com barra final:

```bash
python3 server.py
# -> http://localhost:8000/biblioteca/
```

### Via script do projeto

```bash
npm run serve
# ou
python3 scripts/server.py --dir ./site-clonado --port 8000
```

---

## 8. Tudo de uma vez

```bash
npm run full
# ou
bash scripts/full_clone.sh
```

Passos executados:

1. `clone_wget.sh` – wget base
2. `render_pages.js` – Puppeteer
3. `fetch_assets.sh` – assets extras (se `urls.txt` existir)

---

## Estrutura final esperada

```text
modern-website-offline-cloner/
├── site-clonado/                    # Saída do clone
│   ├── index.html
│   ├── biblioteca/index.html
│   ├── agents/index.html
│   ├── academy/index.html
│   ├── configuracoes/index.html
│   ├── fundador/index.html
│   ├── mcp/index.html
│   ├── testegratis/index.html
│   ├── _next/static/                # Assets Next.js
│   ├── _assets_from_puppeteer/      # Assets capturados via Puppeteer
│   ├── assets/                      # UUIDs baixados manualmente
│   └── api/                         # (opcional) mocks de API
├── scripts/
│   ├── clone_wget.sh
│   ├── render_pages.js
│   ├── fetch_assets.sh
│   ├── server.py
│   └── full_clone.sh
├── cookies.txt.example
├── urls.txt.example
├── package.json
└── README.md
```

---

## Solução de problemas

### `ENOTDIR`

Algum asset tenta ser servido a partir de um caminho onde existe um arquivo.

```bash
rm -rf ./site-clonado/*
```

Limpe antes de cada clone completo.

### Assets salvos como diretórios

`render_pages.js` usa o `Content-Type` para decidir:
- `text/html` → pasta + `index.html`
- `image/*`, `font/*`, `text/css`, `application/javascript`, `application/json` → arquivo com extensão correta

### Páginas sendo baixadas no navegador

Sempre sirva via `server.py` (não via `file://`). Acesse com barra final:

```text
http://localhost:8000/biblioteca/
```

### Rotas não detectadas

Adicione a rota no array `DEFAULT_ROUTES` em `render_pages.js` ou via env:

```bash
ROUTES="/,/minha-rota,/outra-rota" node scripts/render_pages.js
```

### Autenticação expirada

Re-exporte `cookies.txt` após um novo login e rode novamente.

---

## Limitações

- Back‑end, banco de dados, WebSockets e eventos em tempo real **não são clonados**.
- Funcionalidades dependentes de API online precisam de mocks JSON em `site-clonado/api/`.
- `puppeteer-extra-plugin-stealth` ajuda mas **não garante invisibilidade total** — trate como mitigação parcial.

---

## Como adaptar para outro site

1. Troque `BASE_URL` no script ou via env.
2. Ajuste `ROUTES` com as rotas reais do seu site.
3. Atualize `--domains` e `--exclude-domains` no `clone_wget.sh`.
4. Enrijeça o `--reject-regex` se o site tiver rotas de admin/API que não devem ser baixadas.
5. Atualize o user-agent se necessário.

---

## Dicas para evoluir

- **Mockar APIs**: grave respostas JSON no DevTools e salve em `site-clonado/api/...`. Use Requestly/Redirector para redirecionar.
- **Automatizar**: `npm run full` já serve. Integre em cron para "fotografar" painéis periodicamente.
- **Limpeza**: remova pastas temporárias (`complete_clone`, `httrack_temp`) e mantenha apenas `./site-clonado`.

---

## 📌 O que aprendemos aqui

✅ Clone completo do front‑end (HTML, CSS, JS, imagens, fontes)  
✅ Páginas dinâmicas renderizadas com Puppeteer (`/biblioteca`, `/configuracoes`, `/fundador`, `/mcp`, `/testegratis`, `/agents`, `/academy`)  
✅ Rotas adicionais criadas manualmente e preenchidas  
✅ Assets UUID baixados e servidos corretamente  
✅ Servidor local ajustado (`text/html` forçado) — fim do download de páginas  

---

## Aviso legal

Use este projeto apenas em ambientes onde você tem permissão explícita para clonar o front‑end. Não use para violar termos de serviço, leis de direitos autorais ou políticas de privacidade.

---

_Assinado:_  
**NotyPeek** — Estudante e apaixonado por SEC^_^
