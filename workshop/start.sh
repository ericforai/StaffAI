#!/usr/bin/env bash
cd "$(dirname "$0")"
source .env
exec .venv/bin/python main.py
