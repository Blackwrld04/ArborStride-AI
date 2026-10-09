#!/usr/bin/env bash
set -e

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

echo "=================================================="
echo " Starting ArborStride AI Production Server"
echo " Host: ${HOST} | Port: ${PORT}"
echo "=================================================="

# Run uvicorn server
exec uvicorn app.main:app --host "${HOST}" --port "${PORT}" --workers 2
