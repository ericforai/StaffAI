#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${AGENCY_HOME:-$HOME/.agency}"

printf 'Setting up The Agency HQ\n'
printf 'HQ root: %s\n' "$SCRIPT_DIR"
printf 'Runtime state dir: %s\n' "$STATE_DIR"

mkdir -p "$STATE_DIR/config"
mkdir -p "$STATE_DIR/cache/hosts"
mkdir -p "$STATE_DIR/cache/discovery"
mkdir -p "$STATE_DIR/sessions"
mkdir -p "$STATE_DIR/logs"
mkdir -p "$STATE_DIR/generated"
mkdir -p "$STATE_DIR/executors"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but was not found." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but was not found." >&2
  exit 1
fi

if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
  echo "--- Installing backend dependencies ---"
  (cd "$SCRIPT_DIR/backend" && npm install)
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo "--- Installing frontend dependencies ---"
  (cd "$SCRIPT_DIR/frontend" && npm install)
fi

echo "--- Generating runtime artifacts ---"
node "$SCRIPT_DIR/scripts/generate-runtime-artifacts.mjs"

rm -rf "$STATE_DIR/generated"
mkdir -p "$STATE_DIR/generated"
cp -R "$SCRIPT_DIR/generated/." "$STATE_DIR/generated/"

echo "--- Compatibility report ---"
node -e "const fs=require('fs'); const path=require('path'); const hosts=JSON.parse(fs.readFileSync(path.join(process.argv[1],'generated/registry/hosts.json'),'utf8')); console.log(hosts.map((host)=>['- '+host.label, '('+host.capabilityLevel+')', 'executors='+host.supportedExecutors.join(','), 'sampling='+(host.supportsSampling?'on':'off'), 'injection='+(host.supportsInjection?'native':'manual')].join(' ')).join('\n'));" "$SCRIPT_DIR"

echo "Setup complete."
echo "Generated artifacts copied to: $STATE_DIR/generated"
echo "Next step: ./hq/start.sh"
