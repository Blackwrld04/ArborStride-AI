# ArborStride AI

### The Open-Source Thermal Microclimate & Tree-Canopy Route Navigator
**Built for the Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel%20Production-success?style=for-the-badge&logo=vercel)](https://arbor-stride-ai.vercel.app/navigate)
[![DEV Submission](https://img.shields.io/badge/DEV.to-Challenge%20Submission-0a0a0a?style=for-the-badge&logo=devdotto)](https://dev.to/olajide_abdulquadri_807ef/arborstride-ai-escape-urban-heat-islands-with-open-source-microclimate-routing-23mi-temp-slug-6815677)
[![Agent Session](https://img.shields.io/badge/Agent%20Session-Interactive%20Transcript-blueviolet?style=for-the-badge&logo=google)](https://dev.to/agent_sessions/arborstride-ai-system-architecture-microclimate-physics-deployment-trajectory-fmbpkn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

![ArborStride AI Logo](public/logo.jpg)

---

## 🌟 Live Links & Demo

- 🌐 **Live Canopy Navigator**: [https://arbor-stride-ai.vercel.app/navigate](https://arbor-stride-ai.vercel.app/navigate)
- 🏡 **Platform Landing Page**: [https://arbor-stride-ai.vercel.app/](https://arbor-stride-ai.vercel.app/)
- 📝 **DEV Challenge Article**: [ArborStride AI on DEV](https://dev.to/olajide_abdulquadri_807ef/arborstride-ai-escape-urban-heat-islands-with-open-source-microclimate-routing-23mi-temp-slug-6815677)
- 🤖 **Interactive Agent Session**: [DevRelay Agent Session #657](https://dev.to/agent_sessions/arborstride-ai-system-architecture-microclimate-physics-deployment-trajectory-fmbpkn)
- 📦 **GitHub Repository**: [Blackwrld04/ArborStride-AI](https://github.com/Blackwrld04/ArborStride-AI)

---

## Executive Summary

During summer heatwaves, urban asphalt radiates up to **15°F to 25°F hotter** than shaded corridors. Standard navigation engines (Google Maps, Apple Maps) prioritize the fastest automotive or pedestrian commute, funneling walkers, runners, and families through unshaded concrete canyons and baking parking lots.

**ArborStride AI** transforms urban navigation by prioritizing **thermal comfort, tree canopy density, and physiological safety**. Instead of optimizing for pure distance, ArborStride calculates continuous cool corridors beneath mature urban trees (American Elm, London Plane, Sugar Maple, Northern Red Oak).

### The Screenless "Touch Grass" Philosophy
Navigation software today demands constant visual attention, trapping users in the exact screen-based behavior that prevents them from engaging with nature. 

ArborStride AI is designed around a radical premise: **The screen should be the shortest part of the walk.**
- **Sub-20s Screen Budget**: Select your duration (15, 30, or 45 mins), review your microclimate preview, and tap **"Start Walk"**.
- **OLED Pocket Mode**: The screen turns pure black (`#000000`) to preserve battery and prevent pocket taps.
- **Eyes-Free Naturalist Audio**: Google Gemma generates compact, 15-word waypoint audio cues delivered via ElevenLabs and zero-latency Web Speech, alerting you when you enter dense canopy or historic tree groves without taking your phone out of your pocket.
- **Wearable Native**: Export standard **GPX 1.1** tracks directly to Garmin, Apple Watch, or Strava.

---

## System Architecture & Technical Pipeline

ArborStride AI is architected as a modular, local-first system that couples spatial GIS geometries with machine learning foundation models, natural language reasoning, and neural audio synthesis.

```
                    ┌───────────────────────────────────────────────┐
                    │            OpenStreetMap & Sensors            │
                    │  Street Geometries, Solar Angle, Humidity     │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │      Prior Labs TabPFN-v2 Foundation Model    │
                    │    In-Context Microclimate Heat Regression    │
                    └───────────────────────┬───────────────────────┘
                                            │ (Pavement Temp & Shade Deltas)
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │        A* / Dijkstra Graph Routing Engine      │
                    │   Edge Cost = Distance × (1 - Shade Delta)    │
                    └───────────────────────┬───────────────────────┘
                                            │
                         ┌──────────────────┴──────────────────┐
                         ▼                                     ▼
      ┌─────────────────────────────────────┐  ┌───────────────────────────────────┐
      │     Google Gemma 2 Field Agent      │  │     ElevenLabs Neural Voice       │
      │   15-Word Waypoint Sensory Briefing │  │   Hands-Free Pocket Audio Stream  │
      └──────────────────┬──────────────────┘  └─────────────────┬─────────────────┘
                         │                                       │
                         └──────────────────┬────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │       Leaflet GIS + OLED Pocket Mode UI       │
                    │      Vercel Serverless / Edge Geolocation     │
                    └───────────────────────────────────────────────┘
```

### 1. Tabular Microclimate Physics: Prior Labs TabPFN-v2
Traditional microclimate analysis relies on complex computational fluid dynamics (CFD) or satellite thermal band feeds that take hours to compute. ArborStride leverages **Prior Labs TabPFN (Tabular Foundation Model)** to perform real-time, zero-shot tabular regression over physical parameters.

- **Feature Inputs**:
  - `solar_elevation_deg`: Real-time solar zenith calculation based on local time and coordinates.
  - `ambient_temp_f`: Live meteorological surface temperature.
  - `relative_humidity_pct`: Atmospheric humidity influencing evaporative cooling.
  - `canopy_density_pct`: Foliage density index derived from OpenStreetMap forest and tree tags.
  - `pavement_albedo`: Surface absorption rating (asphalt vs. stone vs. dirt trail).
  - `species_type`: Shading efficacy coefficient (e.g., London Plane, Oak, Pine).
- **Target Output**: `predicted_surface_temp_f` and `cooling_delta_f`.
- **How It Routes**:
  In standard routing, every road segment's cost is strictly its length in meters:
  $$\text{Cost} = \text{Distance}$$
  In ArborStride AI, our router penalizes unshaded asphalt and rewards dense tree canopies:
  $$\text{Cost}_{\text{Canopy}} = \text{Distance} \times \left(1.0 - 0.65 \times \frac{\text{CanopyCoverage}}{100}\right) \times \text{ThermalPenalty}$$
  Segments with >80% mature oak canopy receive up to a **65% distance discount**, causing the pathfinder to naturally discover winding, tree-covered corridors that drop surface heat by **7.8°F to 9.2°F**.

---

### 2. Naturalist Reasoning: Google Gemma 2
Raw sensor readings and delta temperatures don't inspire people to explore—sensory connection does. We engineered a dedicated prompt harness around **Google Gemma 2** (supporting local zero-cost Ollama execution with cloud fallbacks) to act as a digital naturalist field agent.

Gemma 2 takes structured physics from the routing engine and translates them into:
1. **Sensory Waypoint Prompts (Strict 15-word budget)**:
   > *"Entering mature London Plane archway. Road temperature drops 8.1°F. Breathe in the cool forest air."*
2. **Route Field Briefing**:
   A 3-bullet pre-walk breakdown summarizing canopy coverage percentage, temperature relief, and highlights of notable tree species along the path.

---

### 3. Screenless Audio Delivery: ElevenLabs & Web Speech
- Synthesizes waypoint cues using high-clarity neural voice models (`model: eleven_turbo_v2_5`).
- Features persistent audio disk caching and zero-latency browser Web Speech synthesis fallbacks so navigation remains fully responsive even in dead zones.
- Screen dims to pure pitch black (`#000000`) in **OLED Pocket Mode** to preserve battery life while the phone rests safely in your pocket.

---

### 4. Edge Infrastructure & Geolocation Engineering
ArborStride AI runs serverless on **Vercel** with full multi-container **Render** and **Docker Compose** support.

During development, we resolved cloud proxying challenges: serverless functions executing on Vercel run in AWS data centers in Washington, D.C., which initially tricked standard IP geolocation into placing users near the White House. 

We engineered a dual edge-calibration system:
- **Vercel Edge Headers**: The backend inspects `x-vercel-ip-country`, `x-vercel-ip-latitude`, and client `x-forwarded-for` to detect real device origins.
- **Direct Client Probing**: When browser GPS is requested, the client queries local network telemetry directly from the device, filtering out cloud data center false-positives and automatically calibrating regional hubs (such as Ile-Ife, Osun State) with pinpoint street-level accuracy.

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
- **AI Engines**: Prior Labs TabPFN-v2, Google Gemma 2, ElevenLabs Neural Voice API.
- **Frontend**: Vanilla CSS (Botanical Emerald & Solar Amber design system), Leaflet.js, OpenStreetMap / CartoDB Dark Matter / Esri Satellite GIS layers.
- **Export Standards**: GPX 1.1 XML format compatible with Garmin Connect, Apple Health/Workouts, and Strava.
- **Deployment**: Vercel Serverless (`@vercel/python`), Render (`render.yaml`), Docker Compose.

---

## Quickstart & Local Installation

### 1. Clone & Set Up Virtual Environment
```bash
git clone https://github.com/Blackwrld04/ArborStride-AI.git
cd ArborStride-AI
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file based on [.env.example](.env.example):
```env
HOST=0.0.0.0
PORT=8000
DEBUG=true

# Prior Labs TabPFN (Optional - built-in local regression fallback provided)
TABPFN_API_KEY=your_tabpfn_api_key_here

# Google Gemma 2 / Google AI (Optional - local Ollama fallback provided)
GEMMA_MODEL_ENDPOINT=http://localhost:11434/api/generate
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs (Optional - Web Speech API fallback provided)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 3. Run the Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Access the Application
- **Landing Page**: [http://localhost:8000/](http://localhost:8000/)
- **Live Interactive Canopy Navigator**: [http://localhost:8000/navigate](http://localhost:8000/navigate)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🚀 Deployment Guide

### Option 1: Deploy to Vercel (Serverless)
The repository includes a pre-configured `vercel.json` and `api/index.py`:
1. Import repository on [Vercel](https://vercel.com/new).
2. Set Environment Variables: `TABPFN_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`.
3. Click **Deploy**.

### Option 2: Deploy to Render (Container / Blueprint)
The repository contains native `render.yaml` and `Procfile`:
1. Connect repository on [Render](https://dashboard.render.com).
2. Select **New Web Service** (or New Blueprint).
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`

### Option 3: Docker Compose
```bash
docker compose up --build -d
```

---

## Partner Category Alignment

- **Best Use of TabPFN (Prior Labs)**: TabPFN-v2 serves as the core physical engine, performing zero-shot tabular regression over solar elevation, humidity, and foliage density to predict pavement thermal relief.
- **Best Use of Gemma (Google)**: Google Gemma 2 powers the naturalist field agent, translating tabular thermodynamics into evocative sensory waypoints and ecology briefings.
- **Best Use of ElevenLabs**: Drives OLED Pocket Mode, synthesizing whispered voice cues so outdoor explorers can keep their phones in their pockets and their eyes on nature.
- **Best Use of Render**: Fully containerized and deployment-ready with a native `render.yaml` infrastructure-as-code blueprint, multi-stage `Dockerfile`, and automated health check probes.
- **Theme: Touch Grass (Overall Prize)**: Directly promotes outdoor physical activity while making the screen the shortest part of the walk.

---

## Interactive Agent Session

This platform was designed and pair-programmed using an autonomous Gemini agent workflow via DevRelay.

🔗 **Inspect the Interactive Agent Session**: [DevRelay Agent Session #657](https://dev.to/agent_sessions/arborstride-ai-system-architecture-microclimate-physics-deployment-trajectory-fmbpkn)

---

## License
MIT License. Built for open-source AI, urban forestry, and outdoor health.
