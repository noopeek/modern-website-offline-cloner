#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.site-exemplo.com/}"
COOKIES_FILE="${COOKIES_FILE:-./cookies.txt}"
OUTPUT_DIR="${OUTPUT_DIR:-./site-clonado}"
CLEAN_OUTPUT="${CLEAN_OUTPUT:-1}"

mkdir -p "${OUTPUT_DIR}"

if [[ "${CLEAN_OUTPUT}" == "1" ]]; then
  echo "[clone_wget] Limpando diretório de saída: ${OUTPUT_DIR}"
  rm -rf "${OUTPUT_DIR:?}/"*
fi

echo "[clone_wget] Iniciando wget para ${BASE_URL}"
wget \
  --mirror \
  --convert-links \
  --adjust-extension \
  --page-requisites \
  --no-parent \
  --span-hosts \
  --domains="site-exemplo.com,www.site-exemplo.com" \
  --exclude-domains="google-analytics.com,www.google-analytics.com,doubleclick.net,facebook.net,connect.facebook.net" \
  --trust-server-names \
  --restrict-file-names=windows \
  --load-cookies="${COOKIES_FILE}" \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --execute robots=off \
  --wait=2 \
  --random-wait \
  --limit-rate=100k \
  --tries=30 \
  --waitretry=5 \
  --retry-connrefused \
  --continue \
  --timeout=30 \
  --dns-timeout=15 \
  --connect-timeout=15 \
  --read-timeout=30 \
  --no-verbose \
  --show-progress \
  --directory-prefix="${OUTPUT_DIR}" \
  --output-file="${OUTPUT_DIR}/wget.log" \
  --rejected-log="${OUTPUT_DIR}/rejected.csv" \
  --quota=2g \
  "${BASE_URL}"

echo "[clone_wget] Clone base concluído em ${OUTPUT_DIR}"
