# ==============================================================================
# ArborStride AI - Production Dockerfile
# Optimized for Render, Railway, Fly.io, Hugging Face, or Bare-Metal Docker
# ==============================================================================

FROM python:3.11-slim as base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

WORKDIR /app

# Install minimal OS dependencies for network & health checking
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application codebase
COPY . .

# Create non-root user for container security
RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/static/audio && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Container Healthcheck Probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Production ASGI Entrypoint
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
