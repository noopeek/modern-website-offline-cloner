#!/usr/bin/env bash
set -euo pipefail

URLS_FILE="${URLS_FILE:-./urls.txt}"
COOKIES_FILE="${COOKIES_FILE:-./cookies.txt}"
OUTPUT_DIR="${OUTPUT_DIR:-./site-clonado/assets-extra}"

if [[ ! -f "${URLS_FILE}" ]]; then
  echo "[fetch_assets] Arquivo ${URLS_FILE} não encontrado. Nada a fazer."
  exit 0
fi

mkdir -p "${OUTPUT_DIR}"

echo "[fetch_assets] Baixando assets listados em ${URLS_FILE} para ${OUTPUT_DIR}"

while IFS= read -r url; do
  [[ -z "${url}" ]] && continue
  [[ "${url}" =~ ^# ]] && continue

  echo "[fetch_assets] -> ${url}"
  wget \
    --load-cookies="${COOKIES_FILE}" \
    --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
    --execute robots=off \
    --wait=1 \
    --random-wait \
    --limit-rate=100k \
    --no-verbose \
    -P "${OUTPUT_DIR}" \
    "${url}"
done < "${URLS_FILE}"

echo "[fetch_assets] Concluído."
