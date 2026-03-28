#!/usr/bin/env bash

# This script starts the full StaffAI dual-core environment:
# 1. TS Office (Backend & Frontend)
# 2. Python Workshop (DeerFlow Execution Core)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "--- Cleaning up previous processes and locks ---"
# Kill any existing processes on the required ports
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3333 | xargs kill -9 2>/dev/null || true
lsof -ti :3008 | xargs kill -9 2>/dev/null || true

# Force remove Next.js dev lock if it exists
rm -rf "$SCRIPT_DIR/frontend/.next/dev/lock" 2>/dev/null || true

# --- Start Python Workshop ---
echo "--- Initializing Python Workshop ---"
cd "$PARENT_DIR/workshop"
if [ ! -d ".venv" ]; then
    echo "Creating Python venv using uv..."
    uv venv --python 3.12
    source .venv/bin/activate
    uv pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# Run Workshop in background
python3 main.py &
WORKSHOP_PID=$!
echo "Python Workshop PID: $WORKSHOP_PID"

# --- Start TS Backend ---
echo "--- Initializing Backend ---"
cd "$SCRIPT_DIR/backend"
# Use 'dev:web' instead of 'dev' as per backend package.json
npm run dev:web &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# --- Start TS Frontend ---
echo "--- Initializing Frontend ---"
cd "$SCRIPT_DIR/frontend"
# Check if we should use port 3000 or 3008 (based on your error log)
PORT=3008 npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "============================================================"
echo "StaffAI Environment is running!"
echo "Workshop (Python): http://localhost:8000"
echo "Backend (TS):      http://localhost:3333"
echo "Frontend (TS):     http://localhost:3008"
echo "============================================================"

# Cleanup on exit
trap "kill $WORKSHOP_PID $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

wait $WORKSHOP_PID $BACKEND_PID $FRONTEND_PID
