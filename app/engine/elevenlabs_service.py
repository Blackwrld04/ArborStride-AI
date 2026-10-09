"""
ElevenLabs Voice Service
Generates eyes-free spoken audio cues for earbud delivery so the user's phone
can stay safely in their pocket while walking or running.
"""

import os
import hashlib
import logging
import requests
from pathlib import Path
from typing import Optional, Dict, Any
from app.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, AUDIO_CACHE_DIR

logger = logging.getLogger("arborstride.elevenlabs")

class ElevenLabsVoiceService:
    def __init__(self, api_key: str = ELEVENLABS_API_KEY, voice_id: str = ELEVENLABS_VOICE_ID):
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY", "")
        self.voice_id = voice_id
        self.api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"

    def synthesize_cue_audio(self, text: str, cue_id: str = None) -> Dict[str, Any]:
        """
        Synthesizes spoken audio for a waypoint cue text.
        Caches the audio file to disk to prevent duplicate API credit usage.
        Returns the relative audio URL and playback metadata.
        """
        text_clean = text.strip()
        text_hash = hashlib.md5(text_clean.encode("utf-8")).hexdigest()[:12]
        filename = f"cue_{cue_id or text_hash}.mp3"
        cached_file = AUDIO_CACHE_DIR / filename

        # Return cached audio if already generated
        if cached_file.exists() and cached_file.stat().st_size > 0:
            return {
                "audio_url": f"/static/audio/{filename}",
                "cached": True,
                "text": text_clean,
                "engine": "ElevenLabs Neural Voice (Cached)"
            }

        # If live API key is present, invoke ElevenLabs TTS
        if self.api_key:
            try:
                headers = {
                    "xi-api-key": self.api_key,
                    "Content-Type": "application/json"
                }
                body = {
                    "text": text_clean,
                    "model_id": "eleven_turbo_v2_5",
                    "voice_settings": {
                        "stability": 0.65,
                        "similarity_boost": 0.78,
                        "style": 0.20,
                        "use_speaker_boost": True
                    }
                }
                resp = requests.post(self.api_url, json=body, headers=headers, timeout=5.0)
                if resp.status_code == 200:
                    with open(cached_file, "wb") as f:
                        f.write(resp.content)
                    return {
                        "audio_url": f"/static/audio/{filename}",
                        "cached": False,
                        "text": text_clean,
                        "engine": "ElevenLabs Turbo v2.5 Voice Stream"
                    }
                else:
                    logger.warning(f"ElevenLabs API responded with status {resp.status_code}")
            except Exception as e:
                logger.warning(f"Failed to call ElevenLabs API: {e}")

        # Web Speech API Client fallback: client will use window.speechSynthesis
        return {
            "audio_url": None,
            "cached": False,
            "text": text_clean,
            "fallback_client_speech": True,
            "engine": "Web Speech Audio Synthesizer (Zero-Latency Local)"
        }

# Global singleton
elevenlabs_service = ElevenLabsVoiceService()
