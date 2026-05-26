#!/usr/bin/env bash
set -euo pipefail

# Baixa uma lista de assets adicionais (ex.: UUIDs, chunks específicos)
# a partir de um arquivo urls.txt (um URL por linha, comentários com #).

URLS_FILE="${URLS_FILE:-./urls.txt}"
COOKIES_FILE="${COOKIES_FILE:-./cookies.txt}"
OUTPUT_DIR="${OUTPUT_DIR:-./site-clonado/assets-extra}"

if [[ ! -f "${URLS_FILE}" ]]; then
  echo "[fetch_assets] Arquivo ${URLS_FILE} não encontrado. Nada a fazer."
  exit 0
fi

mkdir -p "${OUTPUT_DIR}"

# Gera lista temporária sem comentários nem linhas vazias
TMP_URLS=$(mktemp)
trap 'rm -f "${TMP_URLS}"' EXIT

grep -v '^\s*#' "${URLS_FILE}" | grep -v '^\s*$' > "${TMP_URLS}"

COUNT=$(wc -l < "${TMP_URLS}")
echo "[fetch_assets] Baixando ${COUNT} assets para ${OUTPUT_DIR}"

# --input-file lê URLs linha a linha; --wait e --random-wait
# só funcionam quando wget gerencia múltiplos downloads internamente
wget \
  --input-file="${TMP_URLS}" \
  --load-cookies="${COOKIES_FILE}" \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --execute robots=off \
  --wait=1 \
  --random-wait \
  --limit-rate=100k \
  --tries=10 \
  --waitretry=3 \
  --retry-connrefused \
  --no-verbose \
  --show-progress \
  -P "${OUTPUT_DIR}"

echo "[fetch_assets] Concluído."
