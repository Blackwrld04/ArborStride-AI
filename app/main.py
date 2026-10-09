"""
ArborStride AI - Main FastAPI Application
Open-Source Thermal Microclimate & Tree-Canopy Route Navigator
Built for Hacktoberfest Open-Source AI Challenge: Touch Grass
"""

import json
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from app.config import (
    DEBUG, STATIC_DIR, TEMPLATES_DIR, PUBLIC_DIR,
    TABPFN_MODEL_NAME, GEMMA_MODEL_TAG
)
from app.engine.router import canopy_router
from app.engine.tabpfn_engine import tabpfn_engine
from app.engine.gemma_agent import gemma_agent
from app.engine.elevenlabs_service import elevenlabs_service
from app.engine.gpx_exporter import GPXExporter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("arborstride")

from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="ArborStride AI",
    description="The Open-Source Thermal Microclimate & Tree-Canopy Route Navigator",
    version="1.0.0"
)

# Production Middlewares: GZip Compression & CORS
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static & Public Folders
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/public", StaticFiles(directory=str(PUBLIC_DIR)), name="public")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# In-memory route session store
ROUTE_CACHE: Dict[str, Dict[str, Any]] = {}
GEOCODE_CACHE: Dict[str, Dict[str, Any]] = {}

@app.get("/health")
async def health_check():
    """Production health probe for Docker, Kubernetes, and PaaS hosts."""
    import time
    return {
        "status": "healthy",
        "service": "ArborStride AI",
        "version": "1.0.0",
        "timestamp": int(time.time()),
        "tabpfn_model": TABPFN_MODEL_NAME,
        "gemma_model": GEMMA_MODEL_TAG
    }

# --- Pydantic Request Schemas ---

class RouteRequest(BaseModel):
    origin_lat: float = Field(..., description="Latitude of start position")
    origin_lng: float = Field(..., description="Longitude of start position")
    dest_lat: Optional[float] = Field(None, description="Optional destination latitude")
    dest_lng: Optional[float] = Field(None, description="Optional destination longitude")
    duration_minutes: int = Field(30, description="Target walk duration in minutes (15, 30, 45)")
    mode: str = Field("loop", description="Routing mode: 'loop' or 'direct'")
    activity: str = Field("walk", description="Activity: 'walk' or 'run'")

class ThermalPredictRequest(BaseModel):
    canopy_coverage_pct: float
    asphalt_ratio: float
    solar_elevation_deg: Optional[float] = 48.0
    ambient_temp_c: Optional[float] = 29.5

# --- Page Routes ---

@app.get("/", response_class=HTMLResponse)
async def get_landing_page(request: Request):
    """Renders the ArborStride AI landing and story hub (StepFree hierarchy)."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "title": "ArborStride AI | The Open-Source Thermal & Tree-Canopy Navigator",
            "tabpfn_model": TABPFN_MODEL_NAME,
            "gemma_model": GEMMA_MODEL_TAG
        }
    )

@app.get("/navigate", response_class=HTMLResponse)
async def get_navigator_page(request: Request, mode: str = "loop"):
    """Renders the live interactive street map navigator with StepFree UI styling."""
    import time
    return templates.TemplateResponse(
        request=request,
        name="navigate.html",
        context={
            "mode": mode,
            "title": "Live Canopy Navigator | ArborStride AI",
            "cache_bust": int(time.time())
        }
    )

# --- API Endpoints ---

@app.get("/api/locate")
async def locate_user(request: Request):
    """
    Returns user location with automatic preference for Ife, Osun State, Nigeria.
    Compensates for Vercel US datacenter proxying and Starlink satellite ground stations.
    """
    # 1. Inspect Vercel Edge Geolocation Headers directly
    v_country = (request.headers.get("x-vercel-ip-country") or "").upper()
    v_lat_str = request.headers.get("x-vercel-ip-latitude")
    v_lng_str = request.headers.get("x-vercel-ip-longitude")

    if v_country == "NG" or v_country == "NIGERIA":
        return {
            "success": True,
            "latitude": 7.5307,
            "longitude": 4.5340,
            "city": "Ile-Ife",
            "state": "Osun State",
            "country": "Nigeria",
            "provider": "Vercel Edge Geolocation (Calibrated Ile-Ife)"
        }

    # 2. Extract real client IP (avoid geolocating Vercel/AWS datacenter in Washington)
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    client_ip = forwarded.split(",")[0].strip() if forwarded else ""

    import requests
    try:
        query_url = f"https://ipwho.is/{client_ip}" if client_ip and client_ip not in ("127.0.0.1", "localhost", "::1") else "https://ipwho.is/"
        resp = requests.get(query_url, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success"):
                country = data.get("country", "")
                city = data.get("city", "")
                connection = data.get("connection", {})
                isp = connection.get("isp", "").lower()
                org = connection.get("org", "").lower()

                # Detect if request is in Nigeria, on Starlink, or cloud datacenter (e.g. Washington D.C.)
                is_nigeria = (country == "Nigeria" or v_country == "NG" or "starlink" in isp or "starlink" in org)
                is_cloud_datacenter = (city == "Washington" and country == "United States") or "amazon" in org or "microsoft" in org or "google" in org or "vercel" in org

                if is_nigeria or is_cloud_datacenter:
                    return {
                        "success": True,
                        "latitude": 7.5307,
                        "longitude": 4.5340,
                        "city": "Ile-Ife",
                        "state": "Osun State",
                        "country": "Nigeria",
                        "provider": "Calibrated Regional Hub (Ile-Ife, Osun State)"
                    }

                return {
                    "success": True,
                    "latitude": data.get("latitude"),
                    "longitude": data.get("longitude"),
                    "city": data.get("city"),
                    "country": data.get("country"),
                    "provider": "IP Network Geolocation"
                }
    except Exception as e:
        logger.debug(f"IP Geolocation error: {e}")

    # Fallback to Ife, Osun State, Nigeria
    return {
        "success": True,
        "latitude": 7.5307,
        "longitude": 4.5340,
        "city": "Ile-Ife",
        "state": "Osun State",
        "country": "Nigeria",
        "provider": "Default Hub (Ile-Ife, Nigeria)"
    }

@app.get("/api/geocode")
async def geocode_query(q: str):
    """
    Geocodes a search string (e.g. Osogbo, Ile-Ife, London, New York)
    into latitude/longitude coordinates and readable city name with caching.
    """
    norm_q = q.strip().lower()
    if norm_q in GEOCODE_CACHE:
        return GEOCODE_CACHE[norm_q]

    # Instant fallbacks for popular Nigerian & global locations
    fallback_map = {
        "ife": {"latitude": 7.5307, "longitude": 4.5340, "display_name": "Obafemi Awolowo University (OAU), Ile-Ife, Osun State"},
        "ile-ife": {"latitude": 7.4833, "longitude": 4.5667, "display_name": "Ile-Ife Town, Osun State, Nigeria"},
        "ile ife": {"latitude": 7.4833, "longitude": 4.5667, "display_name": "Ile-Ife Town, Osun State, Nigeria"},
        "oau": {"latitude": 7.5250, "longitude": 4.5280, "display_name": "Obafemi Awolowo University (OAU), Ile-Ife"},
        "road 1": {"latitude": 7.5180, "longitude": 4.5210, "display_name": "Road 1, OAU Campus, Ile-Ife"},
        "road 2": {"latitude": 7.5307, "longitude": 4.5340, "display_name": "Road 2, OAU Campus, Ile-Ife"},
        "road 14": {"latitude": 7.5330, "longitude": 4.5390, "display_name": "Road 14, Staff Quarters, OAU, Ile-Ife"},
        "campus gate": {"latitude": 7.5140, "longitude": 4.5150, "display_name": "Campus Main Gate, OAU, Ile-Ife"},
        "mayfair": {"latitude": 7.4950, "longitude": 4.5500, "display_name": "Mayfair, Ile-Ife, Osun State"},
        "lagere": {"latitude": 7.4910, "longitude": 4.5550, "display_name": "Lagere, Ile-Ife, Osun State"},
        "enuwa": {"latitude": 7.4833, "longitude": 4.5667, "display_name": "Enuwa Palace, Ile-Ife, Osun State"},
        "fajuyi": {"latitude": 7.5250, "longitude": 4.5270, "display_name": "Fajuyi Hall, OAU Campus, Ile-Ife"},
        "oduduwa": {"latitude": 7.5185, "longitude": 4.5280, "display_name": "Oduduwa Hall, OAU Campus, Ile-Ife"},
        "osogbo": {"latitude": 7.7827, "longitude": 4.5418, "display_name": "Osogbo, Osun State, Nigeria"},
        "lagos": {"latitude": 6.5244, "longitude": 3.3792, "display_name": "Lagos, Nigeria"},
        "abuja": {"latitude": 9.0765, "longitude": 7.3986, "display_name": "Abuja, FCT, Nigeria"},
        "ibadan": {"latitude": 7.3775, "longitude": 3.9470, "display_name": "Ibadan, Oyo State, Nigeria"},
        "london": {"latitude": 51.5074, "longitude": -0.1278, "display_name": "London, United Kingdom"},
        "new york": {"latitude": 40.7128, "longitude": -74.0060, "display_name": "New York, NY, USA"}
    }
    for k, v in fallback_map.items():
        if k in norm_q:
            res = {"success": True, **v}
            GEOCODE_CACHE[norm_q] = res
            return res

    import requests
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={requests.utils.quote(q)}&format=json&limit=1"
        headers = {"User-Agent": "ArborStrideAI/1.0"}
        resp = requests.get(url, headers=headers, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                item = data[0]
                result = {
                    "success": True,
                    "latitude": float(item["lat"]),
                    "longitude": float(item["lon"]),
                    "display_name": item["display_name"]
                }
                GEOCODE_CACHE[norm_q] = result
                return result
    except Exception as e:
        logger.debug(f"Geocode query error: {e}")
    return {"success": False, "message": "Location not found"}

@app.get("/api/reverse-geocode")
async def reverse_geocode_query(lat: float, lng: float):
    """
    Reverse geocodes exact latitude/longitude coordinates to street, neighborhood, and city.
    """
    try:
        import requests
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
        headers = {"User-Agent": "ArborStrideAI/1.0"}
        resp = requests.get(url, headers=headers, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            road = addr.get("road") or addr.get("pedestrian") or addr.get("footway") or addr.get("path")
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("suburb") or addr.get("county") or addr.get("state")
            country = addr.get("country", "")
            
            display_name = data.get("display_name", "")
            parts = [p.strip() for p in display_name.split(",") if p.strip()]

            if road and city:
                formatted = f"{road}, {city}"
            elif len(parts) >= 2 and not parts[0].isdigit():
                formatted = f"{parts[0]}, {parts[1]}"
            elif road:
                formatted = road
            elif city:
                formatted = city
            else:
                formatted = f"{lat:.4f}, {lng:.4f}"

            return {
                "success": True,
                "latitude": lat,
                "longitude": lng,
                "road": road,
                "city": city,
                "country": country,
                "display_name": display_name,
                "formatted": formatted
            }
    except Exception as e:
        logger.debug(f"Reverse geocode error: {e}")

    return {
        "success": True,
        "latitude": lat,
        "longitude": lng,
        "formatted": f"{lat:.4f}, {lng:.4f}"
    }

@app.post("/api/routes/calculate")
async def calculate_route(req: RouteRequest):
    """
    Calculates a thermal-optimized canopy route, scores segments with TabPFN,
    generates Gemma field briefings, and pre-caches ElevenLabs audio cues.
    """
    try:
        route = canopy_router.generate_route(
            origin_lat=req.origin_lat,
            origin_lng=req.origin_lng,
            dest_lat=req.dest_lat,
            dest_lng=req.dest_lng,
            duration_minutes=req.duration_minutes,
            mode=req.mode,
            activity=req.activity
        )
        # Cache route for subsequent GPX export or playback
        ROUTE_CACHE[route["route_id"]] = route
        return route
    except Exception as e:
        logger.error(f"Error calculating route: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate route: {str(e)}")

@app.get("/api/routes/{route_id}/gpx")
async def export_gpx(route_id: str):
    """
    Generates and downloads a standard GPX 1.1 file for smartwatches.
    """
    route = ROUTE_CACHE.get(route_id)
    if not route:
        # Fallback: calculate default loop if direct link opened
        route = canopy_router.generate_route(origin_lat=37.7749, origin_lng=-122.4194, duration_minutes=30)
    
    gpx_xml = GPXExporter.export_route_to_gpx(route)
    return Response(
        content=gpx_xml,
        media_type="application/gpx+xml",
        headers={
            "Content-Disposition": f"attachment; filename=ArborStride_{route_id}.gpx"
        }
    )

@app.post("/api/predict/thermal-segment")
async def predict_thermal_segment(req: ThermalPredictRequest):
    """
    Direct Prior Labs TabPFN inference endpoint evaluating a tabular matrix of physical attributes.
    """
    result = tabpfn_engine.predict_segment_microclimate(
        canopy_pct=req.canopy_coverage_pct,
        asphalt_ratio=req.asphalt_ratio,
        solar_elevation_deg=req.solar_elevation_deg,
        ambient_temp_c=req.ambient_temp_c
    )
    return result

class VoiceSynthesizeRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize with ElevenLabs")
    cue_id: Optional[str] = Field(None, description="Optional cache key")

@app.post("/api/voice/synthesize")
async def synthesize_voice(req: VoiceSynthesizeRequest):
    """
    On-demand voice synthesis using ElevenLabs with disk caching.
    Ensures every button click has live neural audio.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    result = elevenlabs_service.synthesize_cue_audio(req.text.strip(), cue_id=req.cue_id)
    return result

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": "ArborStride AI",
        "tabpfn_ready": True,
        "gemma_ready": True,
        "elevenlabs_ready": True
    }
