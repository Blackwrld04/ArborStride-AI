# ArborStride AI
### The Open-Source Thermal Microclimate & Tree-Canopy Route Navigator
**Built for the DEV Challenge: Touch Grass (Hacktoberfest 2026)**

![ArborStride AI Logo](public/logo.jpg)

---

## Executive Summary

During summer heatwaves, urban asphalt radiates up to **15°F to 25°F hotter** than shaded corridors. Standard navigation engines (Google Maps, Apple Maps) prioritize the fastest automotive or pedestrian path, funneling walkers, runners, and families through unshaded concrete canyons and baking parking lots.

**ArborStride AI** transforms urban navigation by prioritizing **thermal comfort, tree canopy density, and physiological safety**. Instead of optimizing for pure distance, ArborStride calculates continuous cool corridors beneath mature urban trees (American Elm, London Plane, Sugar Maple, Northern Red Oak).

### The Screenless "Touch Grass" Philosophy
Navigation software today demands constant visual attention, trapping users in the exact screen-based behavior that prevents them from engaging with nature. 

ArborStride AI is designed around a radical premise: **The screen should be the shortest part of the experience.**
- **Sub-20s Screen Budget**: Select a duration (15, 30, or 45 mins), view your canopy thermal preview, and tap **"Start Walk"**.
- **OLED Pocket Mode**: The screen turns pure black to preserve battery and prevent pocket taps.
- **Eyes-Free Naturalist Audio**: Google Gemma generates compact, 15-word waypoint audio cues delivered via ElevenLabs and zero-latency Web Speech, alerting you when you enter dense canopy or historic tree groves without taking your phone out of your pocket.
- **Wearable Native**: Export standard **GPX 1.1** tracks directly to Garmin, Apple Watch, or Strava.

---

## Open-Source AI Architecture

ArborStride AI runs open-source, open-weight AI models locally and at the edge.

```
                           +--------------------------------------+
                           |          User GPS / Query            |
                           |   (Loop / Corridor / Duration)       |
                           +------------------+-------------------+
                                              |
                                              v
+-----------------------+     +-------------------------------+     +-----------------------+
|  Urban Tree Catalog   | --> |      Canopy Graph Engine      | <-- | Microclimate Baseline |
| (Species, LAI, Crown) |     |  Haversine Polygon Generator  |     | (Solar Elevation, °C) |
+-----------------------+     +---------------+---------------+     +-----------------------+
                                              |
                                              v
                              +-------------------------------+
                              |    Prior Labs TabPFN-v2       |
                              |  Tabular Foundation Regressor |
                              | (Canopy %, Asphalt, Radiation)|
                              +---------------+---------------+
                                              |
                          [Surface Temp Delta & Thermal Category]
                                              |
                                              v
                              +-------------------------------+
                              |     Google Gemma 2/3 LLM      |
                              |   Local Naturalist Reasoner   |
                              | (3-Bullet Field Briefing/Cues)|
                              +---------------+---------------+
                                              |
                                              v
                              +-------------------------------+
                              |  ElevenLabs / Local Speech    |
                              |     Hands-Free Audio Feed     |
                              +---------------+---------------+
                                              |
                    +-------------------------+-------------------------+
                    |                                                   |
                    v                                                   v
     +------------------------------+                    +------------------------------+
     |   Leaflet GIS Web Engine     |                    |   GPX 1.1 Smartwatch Sync    |
     | (Thermal Polyline Shading)   |                    | (Garmin / Apple Watch Track) |
     +------------------------------+                    +------------------------------+
```

### 1. Tabular Microclimate Physics: Prior Labs TabPFN
Microclimate solar radiation cannot be modeled accurately with simple linear heuristics. ArborStride leverages **TabPFN (Prior-Data Fitted Network)**, the foundation model for tabular data:
- Ingests physical environmental matrices: canopy closure %, asphalt-to-soil ratio, solar azimuth/elevation, and baseline ambient temperature.
- Delivers instantaneous zero-shot non-linear surface temperature deltas without requiring slow finite-element heat transfer simulations.
- Classifies path segments into dynamic thermal safety tiers:
  - [Cool Corridor] (`#00f076`): >60% canopy, -5°F to -10°F radiant reduction.
  - [Filtered Sun] (`#f59e0b`): 30–60% canopy, partial dappled shade.
  - [Asphalt Island] (`#f43f5e`): <30% canopy, heavy heat accumulation.

### 2. Naturalist Reasoning: Google Gemma 2/3
Rather than generic turn-by-turn text ("Turn right in 200 feet"), **Google Gemma** acts as a local urban naturalist:
- Generates structured, sensory 3-bullet field briefings summarizing tree biodiversity and thermal savings.
- Formulates tight, conversational voice cues (<15 words) that explain *why* the path turns:
  > *"Veer right onto Pine Avenue Mews. Stepping into mature Sugar Maple shade; asphalt cools 6 degrees."*

### 3. Screenless Audio Delivery: ElevenLabs & Web Speech
- Synthesizes waypoint cues using high-clarity neural voice models.
- Features persistent audio disk caching and zero-latency browser Web Speech synthesis fallbacks so navigation remains fully responsive even in dead zones.

---

## Why Open Innovation Matters

| Dimension | Proprietary Closed Models | ArborStride Open-Source AI |
| :--- | :--- | :--- |
| **Privacy & Location Data** | Transmits precise real-time personal GPS coordinates to cloud servers. | **100% Private**: Runs inference locally; geographic coordinates never leave your machine. |
| **Offline Resilience** | Stops working when mobile cell signal drops in deep parks or rural ravines. | **Fully Functional Offline**: TabPFN prior weights and local Gemma models execute with zero connectivity. |
| **Cost & Rate Limits** | Pay-per-token API fees scale with every mile walked. | **Zero Marginal Cost**: Community-driven inference with zero per-query billing. |
| **Microclimate Fine-Tuning** | Generic global routing that cannot adapt to local municipal tree censuses. | **Locally Calibrated**: TabPFN enables instant in-context calibration using municipal open data. |

---

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn, Jinja2, Pydantic, Scikit-Learn, NumPy, SciPy.
- **AI Engines**: Prior Labs TabPFN-v2, Google Gemma, ElevenLabs Speech API.
- **Frontend**: Vanilla CSS (Botanical Emerald & Solar Amber design system), Leaflet.js, CartoDB Dark Matter / OpenStreetMap HOT / Esri Satellite GIS layers.
- **Export Standards**: GPX 1.1 XML format compatible with Garmin Connect, Apple Health/Workouts, and Strava.

---

## Quickstart & Installation

### 1. Clone & Set Up Virtual Environment
```bash
cd /home/blackwrld04/TOUCHGRASS
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Environment Variables (Optional)
Create a `.env` file if using external ElevenLabs or Gemma Cloud endpoints (both have built-in zero-dependency local fallbacks):
```env
ELEVENLABS_API_KEY=your_key_here
GEMMA_API_KEY=your_gemini_or_open_weight_endpoint
```

### 3. Run the Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Access the Application
- **Landing & Story Hub**: [http://localhost:8000/](http://localhost:8000/)
- **Live Interactive Canopy Navigator**: [http://localhost:8000/navigate](http://localhost:8000/navigate)
- **API Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## REST API Reference

### 1. Calculate Thermal Canopy Route
`POST /api/routes/calculate`
```json
{
  "origin_lat": 37.7749,
  "origin_lng": -122.4194,
  "duration_minutes": 30,
  "mode": "loop",
  "activity": "walk"
}
```
**Response:**
```json
{
  "route_id": "arbor_8a3dde5d",
  "total_distance_km": 2.86,
  "avg_canopy_pct": 62.4,
  "canopy_temp_f": 78.2,
  "conventional_temp_f": 84.8,
  "temp_savings_f": 6.6,
  "gemma_briefing": "This 30-minute loop directs you through the mature American Elm and London Plane corridor...",
  "maneuvers": [...]
}
```

### 2. Export Watch GPX File
`GET /api/routes/{route_id}/gpx`
Downloads a standard GPX 1.1 XML file with thermal waypoint metadata.

### 3. Prior Labs TabPFN Thermal Prediction
`POST /api/predict/thermal-segment`
```json
{
  "canopy_coverage_pct": 75.0,
  "asphalt_ratio": 0.25,
  "solar_elevation_deg": 52.0,
  "ambient_temp_c": 31.0
}
```

---

## 🚀 Deployment & Host-Ready Guide

ArborStride AI is fully containerized and host-ready for any cloud provider, container registry, or VPS:

### Option 1: Docker / Docker Compose
```bash
# Build and run containerized service
docker compose up --build -d

# Check live health status
curl http://localhost:8000/health
```

### Option 2: 1-Click Render / Railway Deploy
The repository contains native `render.yaml` and `Procfile`:
1. Push to your GitHub repository.
2. Link your repo on **Render** (New -> Blueprint) or **Railway** (New -> GitHub Repo).
3. Set your environment secrets (`TABPFN_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`).
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`

### Option 3: Direct VPS / Linux Server
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./start.sh
```

---

## Partner Category Alignment

- **Best Use of TabPFN ($200)**: First-in-class application of TabPFN foundation tabular models to thermodynamic microclimate prediction and solar radiation attenuation.
- **Best Use of Gemma ($200)**: Real-time naturalist reasoning, translating complex environmental canopy indices into concise, human-centric spoken field briefings.
- **Best Use of ElevenLabs ($100)**: Hands-free, eyes-free audio cues powering OLED Pocket Mode to get people off their screens and into nature.
- **Theme: Touch Grass (Overall $250)**: Directly promotes outdoor physical activity while minimizing screen time to under 20 seconds.

---

## License
MIT License. Built for open-source AI and urban reforestation.
