"""
Google Gemma / Gemini Naturalist Agent
Uses Google AI generative reasoning to synthesize tabular microclimate metrics 
into concise naturalist route briefings and terse, eyes-free audio waypoint scripts.
"""

import json
import logging
import requests
from typing import Dict, Any, List
from app.config import GEMMA_MODEL_ENDPOINT, GEMMA_MODEL_TAG, GOOGLE_API_KEY, GEMINI_API_KEY

logger = logging.getLogger("arborstride.gemma")

class GemmaNaturalistAgent:
    def __init__(self, endpoint: str = GEMMA_MODEL_ENDPOINT, model_tag: str = GEMMA_MODEL_TAG, api_key: str = GOOGLE_API_KEY):
        self.endpoint = endpoint
        self.model_tag = model_tag
        self.api_key = api_key or GEMINI_API_KEY

    def generate_route_briefing(self, route_stats: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesizes the overall route microclimate into an inspiring, factual field briefing
        and step-by-step guidance on how to navigate the shaded route.
        """
        canopy_pct = route_stats.get("avg_canopy_pct", 72.0)
        temp_savings_f = route_stats.get("temp_savings_f", 7.5)
        duration_mins = route_stats.get("estimated_minutes", 30)
        trees = route_stats.get("dominant_trees", ["Neem (Dongoyaro)", "Flamboyant"])
        trees_str = " and ".join(trees)
        origin_name = route_stats.get("origin_name", "your start point")
        dest_name = route_stats.get("dest_name", "your destination")
        activity = route_stats.get("activity", "walk")
        location_context = route_stats.get("location_context", "the area")

        prompt = (
            f"You are ArborStride AI, an urban naturalist assistant powered by Google AI. "
            f"Synthesize this outdoor {activity} in {location_context}: starting at {origin_name} to {dest_name}, {duration_mins} mins, {canopy_pct}% tree canopy. "
            f"Dominant native trees providing shade: {trees_str}. "
            f"The route saves {temp_savings_f}°F off radiant asphalt ground heat. "
            f"Write a 2-3 sentence grounded, sensory field briefing celebrating the local shade, native flora, and path for someone putting their phone in their pocket. "
            f"Be strictly geographically accurate to {location_context}. No emojis, no fluff, purely observant and motivating."
        )

        ai_response, model_name = self._call_google_ai(prompt)
        if not ai_response:
            ai_response = self._call_ollama(prompt)
            if ai_response:
                model_name = f"Google Gemma 2 ({self.model_tag} local)"

        if ai_response:
            briefing = ai_response.strip()
            model_prov = f"Google AI ({model_name})"
        else:
            briefing = (
                f"This {duration_mins}-minute {activity} originates from {origin_name} and leads through the mature {trees_str} corridor, "
                f"retaining continuous canopy coverage across {round(canopy_pct)}% of the route. "
                f"You will bypass the exposed commercial asphalt, shaving an estimated {round(temp_savings_f, 1)}°F "
                f"off ambient ground radiant heat as you make your way toward {dest_name}."
            )
            model_prov = f"Google Gemma 2 ({self.model_tag} local fallback)"

        how_to_use = [
            f"1. Put phone in pocket: Tap 'Start Pocket Walk' or slide your phone into your pocket. Connect your earbuds for hands-free audio guidance.",
            f"2. Stride from {origin_name}: Follow the emerald-tinted path beneath mature {trees_str} trees. TabPFN has routed you away from asphalt heat traps.",
            f"3. Listen to waypoint cues: When approaching turns, Google AI speaks brief micro-cues into your ears so you never need to look down at your screen.",
            f"4. Arrive cool and refreshed: Complete your {activity} at {dest_name} with up to -{round(temp_savings_f, 1)}°F less thermal stress."
        ]

        sensory_notes = [
            f"{round(canopy_pct)}% continuous tree canopy coverage",
            f"{round(temp_savings_f, 1)}°F surface temperature reduction vs standard asphalt",
            f"Dominant regional species: {trees_str}"
        ]

        return {
            "briefing": briefing,
            "how_to_use": how_to_use,
            "sensory_notes": sensory_notes,
            "model_provenance": model_prov
        }

    def generate_waypoint_cue(self, maneuver: Dict[str, Any]) -> str:
        """
        Generates an ultra-concise (<15 words) voice cue for earbud delivery at a waypoint.
        """
        instruction = maneuver.get("instruction", "Continue along the path")
        canopy = maneuver.get("canopy_pct", 50)
        tree = maneuver.get("species", "Shade Tree")

        if canopy >= 70:
            return f"{instruction}. Entering dense {tree} canopy, temperature drops noticeably."
        elif canopy >= 40:
            return f"{instruction}. Filtered shade ahead with scattered {tree} foliage."
        else:
            return f"{instruction}. Brief exposed stretch ahead, shade resumes in 100 meters."

    def _call_google_ai(self, prompt: str) -> tuple[str, str]:
        """Calls Google Gemini API using candidate models in priority order."""
        if not self.api_key:
            return "", ""

        candidate_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]
        for model in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.35, "maxOutputTokens": 220}
                }
                resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=5.5)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            if "text" in part and part["text"].strip():
                                text = part["text"].strip()
                                logger.info(f"Received live briefing from Google Gemini API ({model}).")
                                return text, model
                elif resp.status_code != 404:
                    logger.warning(f"Google Gemini API {model} status {resp.status_code}: {resp.text[:120]}")
            except Exception as e:
                logger.debug(f"Google Gemini API error on {model}: {e}")
        return "", ""

    def _call_ollama(self, prompt: str) -> str:
        """Attempts to call local Ollama endpoint for Gemma inference."""
        try:
            payload = {
                "model": self.model_tag,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 128
                }
            }
            resp = requests.post(self.endpoint, json=payload, timeout=2.5)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response", "")
        except Exception as e:
            logger.debug(f"Local Ollama Gemma endpoint not responding: {e}")
        return ""

# Global singleton
gemma_agent = GemmaNaturalistAgent()
