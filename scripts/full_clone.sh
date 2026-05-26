#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.site-exemplo.com/}"
COOKIES_FILE="${COOKIES_FILE:-./cookies.txt}"
OUTPUT_DIR="${OUTPUT_DIR:-./site-clonado}"

export BASE_URL
export COOKIES_FILE
export OUTPUT_DIR

echo "[full_clone] Iniciando clone completo para ${BASE_URL}"

./scripts/clone_wget.sh

node ./scripts/render_pages.js

if [[ -f "./urls.txt" ]]; then
  ./scripts/fetch_assets.sh
else
  echo "[full_clone] urls.txt não encontrado, pulando fetch_assets."
fi

echo "[full_clone] Clone completo concluído em ${OUTPUT_DIR}"
