import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def load_env_file():
    """Lightweight built-in .env loader with fallback to .env.example."""
    env_paths = [BASE_DIR / ".env", BASE_DIR / ".env.example"]
    for env_path in env_paths:
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key not in os.environ:
                        os.environ[key] = val

load_env_file()

# Server Config
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# AI / Partner Tech Settings
TABPFN_API_KEY = os.getenv("TABPFN_API_KEY", "")
TABPFN_MODEL_NAME = os.getenv("TABPFN_MODEL_NAME", "prior-labs/TabPFN-v2")
TABPFN_DEVICE = os.getenv("TABPFN_DEVICE", "cpu")

# Google Gemini / Gemma 2
GEMMA_MODEL_ENDPOINT = os.getenv("GEMMA_MODEL_ENDPOINT", "http://localhost:11434/api/generate")
GEMMA_MODEL_TAG = os.getenv("GEMMA_MODEL_TAG", "gemini-3.8-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") or GEMINI_API_KEY

# ElevenLabs
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

# Static & Asset Directories
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
DATA_DIR = BASE_DIR / "app" / "data"
PUBLIC_DIR = BASE_DIR / "public"
AUDIO_CACHE_DIR = STATIC_DIR / "audio"

AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
