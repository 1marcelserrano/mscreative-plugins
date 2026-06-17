#!/usr/bin/env bash
# Baixa os assets do Tesseract.js pinados pra rodar 100% local (CSP do MV3 proíbe CDN).
# Rode de dentro de vendor/:  bash FETCH.sh
set -euo pipefail

TESS_VERSION="5.1.1"        # tesseract.js
CORE_VERSION="5.1.1"        # tesseract.js-core
LANG_BASE="https://cdn.jsdelivr.net/npm/@tesseract.js-data"

cd "$(dirname "$0")"

echo "→ tesseract.min.js (v${TESS_VERSION})"
curl -fsSL "https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.min.js" -o tesseract.min.js

echo "→ worker.min.js (v${TESS_VERSION})"
curl -fsSL "https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/worker.min.js" -o worker.min.js

echo "→ tesseract-core.wasm.js (v${CORE_VERSION})"
curl -fsSL "https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VERSION}/tesseract-core.wasm.js" -o tesseract-core.wasm.js

mkdir -p lang
echo "→ por.traineddata.gz"
curl -fsSL "${LANG_BASE}/por/4.0.0_best_int/por.traineddata.gz" -o lang/por.traineddata.gz
echo "→ eng.traineddata.gz"
curl -fsSL "${LANG_BASE}/eng/4.0.0_best_int/eng.traineddata.gz" -o lang/eng.traineddata.gz

echo "✓ Vendor pronto."
ls -lh tesseract.min.js worker.min.js tesseract-core.wasm.js lang/*.gz
