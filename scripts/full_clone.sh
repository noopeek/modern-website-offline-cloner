#!/usr/bin/env bash
set -euo pipefail

# Orquestra o clone completo:
# 1. wget (clone base estático)
# 2. Puppeteer (renderização de rotas dinâmicas)
# 3. wget --input-file (assets extras listados em urls.txt)

# Resolve caminhos relativos ao diretório do próprio script,
# independente de onde o usuário chama o full_clone.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"

export BASE_URL="${BASE_URL:-https://www.site-exemplo.com/}"
export COOKIES_FILE="${COOKIES_FILE:-${ROOT_DIR}/cookies.txt}"
export OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/site-clonado}"
export URLS_FILE="${URLS_FILE:-${ROOT_DIR}/urls.txt}"

echo "[full_clone] ======================================"
echo "[full_clone] Clone completo iniciado"
echo "[full_clone] URL      : ${BASE_URL}"
echo "[full_clone] Cookies  : ${COOKIES_FILE}"
echo "[full_clone] Saída    : ${OUTPUT_DIR}"
echo "[full_clone] ======================================"

# 1. clone base
"${SCRIPT_DIR}/clone_wget.sh"

# 2. renderização de rotas
node "${SCRIPT_DIR}/render_pages.js"

# 3. assets extras (se urls.txt existir e não estiver vazio)
if [[ -f "${URLS_FILE}" ]] && [[ -s "${URLS_FILE}" ]]; then
  "${SCRIPT_DIR}/fetch_assets.sh"
else
  echo "[full_clone] urls.txt não encontrado ou vazio, pulando fetch_assets."
fi

echo "[full_clone] ======================================"
echo "[full_clone] ✓ Clone completo em ${OUTPUT_DIR}"
echo "[full_clone] ======================================"
