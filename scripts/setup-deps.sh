#!/usr/bin/env bash
set -euo pipefail

# Dependency bootstrap helper for restricted networks.
# This script is a suggestion for local setup; the agent should not rely on
# running it successfully in CI/sandbox environments with blocked registries.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[setup] Bootstrapping dependencies for image-similarity-checker"

if [[ -n "${NPM_REGISTRY:-}" ]]; then
  echo "[setup] Using NPM_REGISTRY=$NPM_REGISTRY"
  npm config set registry "$NPM_REGISTRY"
else
  echo "[setup] Using npm default registry: $(npm config get registry)"
fi

# Prefer reproducible install when lockfile exists.
if [[ -f package-lock.json ]]; then
  echo "[setup] package-lock.json detected, running npm ci"
  npm ci
else
  echo "[setup] no lockfile detected, running npm install"
  npm install
fi

echo "[setup] Done. Run: npm start"
