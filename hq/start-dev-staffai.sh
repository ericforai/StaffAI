#!/usr/bin/env bash

# This script starts the full StaffAI dual-core environment:
# 1. TS Office (Backend & Frontend)
# 2. Python Workshop (DeerFlow Execution Core)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Start Python Workshop ---
echo "--- Initializing Python Workshop ---"
cd "$PARENT_DIR/workshop"
if [ ! -d "venv" ]; then
    echo "Creating Python venv..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

python3 main.py &
WORKSHOP_PID=$!
echo "Python Workshop PID: $WORKSHOP_PID"

# --- Start TS Backend ---
echo "--- Initializing Backend ---"
cd "$SCRIPT_DIR/backend"
# Use dev mode for backend
npm run dev &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# --- Start TS Frontend ---
echo "--- Initializing Frontend ---"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "============================================================"
echo "StaffAI Environment is running!"
echo "Workshop (Python): http://localhost:8000"
echo "Backend (TS):      http://localhost:3333"
echo "Frontend (TS):     http://localhost:3000"
echo "============================================================"

# Cleanup on exit
trap "kill $WORKSHOP_PID $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

wait $WORKSHOP_PID $BACKEND_PID $FRONTEND_PID
