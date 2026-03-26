#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${AGENCY_HOME:-$HOME/.agency}"

echo "Starting The Agency HQ from: $SCRIPT_DIR"
echo "Using Agency runtime dir: $STATE_DIR"

mkdir -p "$STATE_DIR/config" "$STATE_DIR/cache/hosts" "$STATE_DIR/cache/discovery" "$STATE_DIR/sessions" "$STATE_DIR/logs" "$STATE_DIR/generated" "$STATE_DIR/executors"

if [ ! -f "$SCRIPT_DIR/generated/registry/hosts.json" ]; then
  echo "--- Runtime artifacts not found, generating them first ---"
  node "$SCRIPT_DIR/scripts/generate-runtime-artifacts.mjs"
fi

export AGENCY_MCP_SAMPLING_POLICY="${AGENCY_MCP_SAMPLING_POLICY:-client}"
echo "AGENCY_MCP_SAMPLING_POLICY=$AGENCY_MCP_SAMPLING_POLICY"

echo "--- Initializing Backend ---"
cd "$SCRIPT_DIR/backend"
npm run build
npm run start:web &
BACKEND_PID=$!

echo "--- Initializing Frontend ---"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo "============================================================"
echo "HQ Dashboard is running at: http://localhost:8888"
echo "Backend API is running at:  http://localhost:3333"
echo "Runtime artifacts:          $SCRIPT_DIR/generated"
echo "Agency runtime dir:         $STATE_DIR"
echo "Host registry:              $SCRIPT_DIR/generated/registry/hosts.json"
echo "Recommendation API:         http://localhost:3333/api/runtime/recommend"
echo ""
echo "To connect clients via MCP, add the following to your MCP settings:"
echo "Command: node"
echo "Args:    $SCRIPT_DIR/backend/dist/mcp-server.js"
echo "Env:     AGENCY_MCP_SAMPLING_POLICY=$AGENCY_MCP_SAMPLING_POLICY"
echo "============================================================"

trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

wait $FRONTEND_PID $BACKEND_PID
