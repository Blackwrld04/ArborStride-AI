/**
 * ArborStride AI - Live Interactive Navigator
 * StepFree Architecture + Prior Labs TabPFN Microclimate + Google Gemma AI Naturalist
 */

let map = null;
let currentTileLayer = null;
let originMarker = null;
let destMarker = null;
let travelerMarker = null;
let routePolylines = [];

let currentRouteData = null;
let currentMode = "direct"; // "direct" (Direct Path) or "loop" (Shaded Loop)
let selectedDuration = 30;
let selectedActivity = "walk";
let selectionTarget = "origin"; // "origin" or "dest"

// Default Coordinates: Ile-Ife, Osun State, Nigeria (OAU Campus)
let originCoord = [7.5307, 4.5340];
let destCoord = [7.5387, 4.5410];

// Journey Simulation State
let isSimulating = false;
let simProgress = 0.0;
let simSpeed = 2.0;
let simAnimId = null;
let lastSimTime = 0;
let activeWaypointIndex = -1;

// OLED Pocket Mode & WakeLock
let wakeLock = null;
let accuracyCircle = null;

// UI Display Helpers
function updateStartDisplay(title, coordsText) {
  const lbl = document.getElementById("start-label");
  if (lbl) {
    lbl.textContent = coordsText ? `${title} (${coordsText})` : title;
  }
}

function updateDestDisplay(title, coordsText) {
  const lbl = document.getElementById("dest-label");
  if (lbl) {
    lbl.textContent = coordsText ? `${title} (${coordsText})` : title;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  initUIListeners();
  
  // Check URL query parameters (e.g., /navigate?origin=osogbo&target=30+Min+Tree-Shaded+Loop)
  const hasQuery = await handleUrlQuery();

  // Always calculate and present route for the user immediately!
  calculateCanopyRoute();
});

async function handleUrlQuery() {
  const params = new URLSearchParams(window.location.search);
  const originRaw = params.get("origin") || "";
  const targetRaw = params.get("target") || "";
  const destRaw = params.get("destination") || params.get("dest") || "";

  if (targetRaw && targetRaw.toLowerCase().includes("loop")) {
    setMode("loop");
  }

  // Parse compound origins like "osogbo, ile-ife" or "osogbo to ile-ife"
  let originQuery = originRaw.trim();
  let destinationQuery = destRaw.trim();

  if (!destinationQuery && originQuery) {
    if (originQuery.includes(",")) {
      const parts = originQuery.split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        originQuery = parts[0];
        destinationQuery = parts[1];
      }
    } else if (/\s+to\s+/i.test(originQuery)) {
      const parts = originQuery.split(/\s+to\s+/i).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        originQuery = parts[0];
        destinationQuery = parts[1];
      }
    }
  }

  if (originQuery) {
    try {
      setMapPrompt(`Locating "${originQuery}"...`);
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(originQuery)}`);
      const data = await res.json();
      if (data && data.success) {
        originCoord = [data.latitude, data.longitude];
        setOriginMarker(originCoord[0], originCoord[1]);
        map.setView(originCoord, 16);
        updateStartDisplay(data.display_name.split(",")[0], `${originCoord[0].toFixed(5)}, ${originCoord[1].toFixed(5)}`);
        
        // Handle destination if provided
        if (destinationQuery && currentMode === "direct") {
          const destRes = await fetch(`/api/geocode?q=${encodeURIComponent(destinationQuery)}`);
          const destData = await destRes.json();
          if (destData && destData.success) {
            destCoord = [destData.latitude, destData.longitude];
            setDestMarker(destCoord[0], destCoord[1]);
            updateDestDisplay(destData.display_name.split(",")[0], `${destCoord[0].toFixed(5)}, ${destCoord[1].toFixed(5)}`);
          } else {
            destCoord = [data.latitude + 0.008, data.longitude + 0.009];
            setDestMarker(destCoord[0], destCoord[1]);
            updateDestDisplay("Nearby Canopy Point", `${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}`);
          }
        } else {
          destCoord = [data.latitude + 0.008, data.longitude + 0.009];
          setDestMarker(destCoord[0], destCoord[1]);
          updateDestDisplay("Nearby Canopy Point", `${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}`);
        }

        setMapPrompt(`Centered on ${data.display_name.split(",")[0]} · Finding canopy route...`);
        return true;
      }
    } catch (e) {
      console.log("Query geocoding error:", e);
    }
  } else {
    // No query provided: center on user's calibrated physical location (Ife, Osun State)
    try {
      const locRes = await fetch("/api/locate");
      const locData = await locRes.json();
      if (locData && locData.success) {
        let lat = locData.latitude;
        let lng = locData.longitude;
        // Compensate for Vercel US cloud proxying
        if ((Math.abs(lat - 38.895) < 0.2 && Math.abs(lng - (-77.036)) < 0.2) || locData.country === "United States") {
          lat = 7.5307;
          lng = 4.5340;
        }
        originCoord = [lat, lng];
        destCoord = [lat + 0.008, lng + 0.009];
        setOriginMarker(originCoord[0], originCoord[1]);
        setDestMarker(destCoord[0], destCoord[1]);
        map.setView(originCoord, 16);
        const placeName = (lat === 7.5307) ? "Road 2, OAU Campus, Ifẹ̀" : (locData.city ? `${locData.city}` : "Ifẹ̀, Osun State");
        updateStartDisplay(placeName, `${originCoord[0].toFixed(5)}, ${originCoord[1].toFixed(5)}`);
        updateDestDisplay("Road 25, Ifẹ̀", `${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}`);
        return true;
      }
    } catch (e) {
      console.log("Auto-locate fallback:", e);
    }
  }
  return false;
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView(originCoord, 16);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Standard OpenStreetMap: Full building footprints, house outlines, local streets, alleys, and green canopy!
  const osmStreetTiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  const darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: "abcd",
    maxZoom: 19
  });

  const satTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  });

  // Default: OpenStreetMap with full buildings, houses, and street detail
  currentTileLayer = osmStreetTiles;
  currentTileLayer.addTo(map);

  // Guarantee map size is calculated properly so no gray canvas appears
  setTimeout(() => { if (map) map.invalidateSize(); }, 200);
  setTimeout(() => { if (map) map.invalidateSize(); }, 600);
  window.addEventListener("resize", () => { if (map) map.invalidateSize(); });

  // Tile switcher events
  document.getElementById("tile-streets")?.addEventListener("click", () => switchTileLayer(osmStreetTiles, "tile-streets"));
  document.getElementById("tile-dark")?.addEventListener("click", () => switchTileLayer(darkTiles, "tile-dark"));
  document.getElementById("tile-satellite")?.addEventListener("click", () => switchTileLayer(satTiles, "tile-satellite"));

  // Set default markers
  setOriginMarker(originCoord[0], originCoord[1]);
  setDestMarker(destCoord[0], destCoord[1]);
  updateStartDisplay("Obafemi Awolowo University, Ifẹ̀", `${originCoord[0].toFixed(4)}, ${originCoord[1].toFixed(4)}`);
  updateDestDisplay("Road 25, Ifẹ̀", `${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}`);

  // Click on map to set points with reverse geocoding & coordinate display
  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (selectionTarget === "origin") {
      setOriginMarker(lat, lng, false);
      if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
      updateStartDisplay(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      
      // Reverse geocode clicked point in background
      fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.formatted) {
            updateStartDisplay(d.formatted, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        }).catch(() => {});

      if (currentMode === "direct") {
        selectionTarget = "dest";
        document.getElementById("btn-pick-dest")?.classList.add("is-active");
        document.getElementById("btn-pick-start")?.classList.remove("is-active");
        setMapPrompt("Click the map to set your destination");
      } else {
        setMapPrompt(`Start point set to ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        calculateCanopyRoute();
      }
    } else {
      setDestMarker(lat, lng);
      updateDestDisplay(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.formatted) {
            updateDestDisplay(d.formatted, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        }).catch(() => {});
      setMapPrompt("Calculating cool corridor...");
      calculateCanopyRoute();
    }
  });
}

function setMapPrompt(text) {
  const overlay = document.getElementById("map-prompt-overlay");
  if (!overlay) return;
  overlay.innerHTML = `<span>${text}</span>`;
}

function switchTileLayer(newLayer, activeBtnId) {
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer = newLayer;
  currentTileLayer.addTo(map);

  document.querySelectorAll(".stepfree-tile-btn").forEach(btn => btn.classList.remove("is-active"));
  document.getElementById(activeBtnId)?.classList.add("is-active");
}

function setOriginMarker(lat, lng, isGpsPinpoint = false) {
  originCoord = [lat, lng];
  if (originMarker) map.removeLayer(originMarker);

  const customIcon = L.divIcon({
    className: "custom-pin origin-pin",
    html: isGpsPinpoint ? `
      <div style="position: relative; width: 32px; height: 32px; display:flex; align-items:center; justify-content:center;">
        <div style="position: absolute; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.4); border-radius: 50%; animation: pulse-gps 1.5s infinite;"></div>
        <div style="width: 18px; height: 18px; background: #10b981; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.5); z-index: 2;"></div>
      </div>
    ` : `<div style="background: #10b981; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 2px 12px rgba(0,0,0,0.4);"></div>`,
    iconSize: isGpsPinpoint ? [32, 32] : [22, 22],
    iconAnchor: isGpsPinpoint ? [16, 16] : [11, 11]
  });

  originMarker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
  originMarker.on("dragend", async (e) => {
    const pos = e.target.getLatLng();
    originCoord = [pos.lat, pos.lng];
    if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${pos.lat}&lng=${pos.lng}`);
      const data = await res.json();
      const placeStr = data.formatted || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
      updateStartDisplay(placeStr, `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
    } catch(err) {
      updateStartDisplay(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
    }
    calculateCanopyRoute();
  });
}

function setDestMarker(lat, lng) {
  destCoord = [lat, lng];
  if (destMarker) map.removeLayer(destMarker);

  const customIcon = L.divIcon({
    className: "custom-pin dest-pin",
    html: `<div style="background: #0f172a; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 2px 12px rgba(0,0,0,0.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  destMarker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
  destMarker.on("dragend", async (e) => {
    const pos = e.target.getLatLng();
    destCoord = [pos.lat, pos.lng];
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${pos.lat}&lng=${pos.lng}`);
      const data = await res.json();
      const placeStr = data.formatted || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
      updateDestDisplay(placeStr, `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);
    } catch(err) {
      updateDestDisplay(`${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);
    }
    calculateCanopyRoute();
  });
}

function setMode(mode) {
  const btnDirect = document.getElementById("nav-mode-direct");
  const btnLoop = document.getElementById("nav-mode-loop");
  const btnPickStart = document.getElementById("btn-pick-start");
  const btnPickDest = document.getElementById("btn-pick-dest");
  const durationControls = document.getElementById("duration-controls");

  if (mode === "direct") {
    btnDirect?.classList.add("is-active");
    btnLoop?.classList.remove("is-active");
    currentMode = "direct";
    selectionTarget = "origin";
    if (btnPickDest) btnPickDest.style.display = "flex";
    if (durationControls) durationControls.style.display = "none";
    btnPickStart?.classList.add("is-active");
    btnPickDest?.classList.remove("is-active");
    setMapPrompt("Click the map to set your start");
  } else {
    btnLoop?.classList.add("is-active");
    btnDirect?.classList.remove("is-active");
    currentMode = "loop";
    selectionTarget = "origin";
    if (btnPickDest) btnPickDest.style.display = "none";
    if (durationControls) durationControls.style.display = "block";
    btnPickStart?.classList.add("is-active");
    setMapPrompt("Click the map to set loop start");
  }
}

function initUIListeners() {
  const btnDirect = document.getElementById("nav-mode-direct");
  const btnLoop = document.getElementById("nav-mode-loop");
  const btnPickStart = document.getElementById("btn-pick-start");
  const btnPickDest = document.getElementById("btn-pick-dest");

  // Mode Selection: Direct Path vs Shaded Loop
  btnDirect?.addEventListener("click", () => setMode("direct"));
  btnLoop?.addEventListener("click", () => {
    setMode("loop");
    calculateCanopyRoute();
  });

  // Pick Start / Dest boxes
  btnPickStart?.addEventListener("click", () => {
    selectionTarget = "origin";
    btnPickStart.classList.add("is-active");
    btnPickDest?.classList.remove("is-active");
    setMapPrompt("Click the map to set your start");
  });

  btnPickDest?.addEventListener("click", () => {
    selectionTarget = "dest";
    btnPickDest.classList.add("is-active");
    btnPickStart?.classList.remove("is-active");
    setMapPrompt("Click the map to set your destination");
  });

  // Mobile Bottom Sheet Toggling & Map Interaction
  const mobileSheetBar = document.getElementById("mobile-sheet-bar");
  const mobileMapToggle = document.getElementById("mobile-map-toggle");
  const navPanel = document.getElementById("navigator-panel");
  const toggleText = document.getElementById("mobile-toggle-text");

  const toggleMobileSheet = (e) => {
    if (e) e.stopPropagation();
    if (!navPanel) return;
    const isMin = navPanel.classList.toggle("is-minimized");
    if (toggleText) {
      toggleText.textContent = isMin ? "Route Details" : "Show Map";
    }
    setTimeout(() => { if (map) map.invalidateSize(); }, 350);
  };

  mobileSheetBar?.addEventListener("click", toggleMobileSheet);
  mobileMapToggle?.addEventListener("click", toggleMobileSheet);

  // Use Current Location: Exact device GPS with high accuracy & pinpoint zoom
  const btnLocateMe = document.getElementById("btn-locate-me");
  btnLocateMe?.addEventListener("click", async () => {
    btnLocateMe.classList.add("is-locating");
    btnLocateMe.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      <span>Pinpointing location...</span>
    `;
    updateStartDisplay("Acquiring GPS / location fix...", "");
    setMapPrompt("Acquiring exact location coordinates...");

    const resetLocateBtn = () => {
      btnLocateMe.classList.remove("is-locating");
      btnLocateMe.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="22" x2="18" y1="12" y2="12"></line><line x1="6" x2="2" y1="12" y2="12"></line><line x1="12" x2="12" y1="6" y2="12"></line><line x1="12" x2="12" y1="22" y2="18"></line></svg>
        <span>Use my location as start</span>
      `;
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          resetLocateBtn();
          let lat = pos.coords.latitude;
          let lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 15);

          // Starlink Gateway / Lagos ISP Teleport Detection:
          const isLagosStarlinkGateway = (
            (Math.abs(lat - 6.45407) < 0.12 && Math.abs(lng - 3.39467) < 0.12) ||
            (lat >= 6.40 && lat <= 6.56 && lng >= 3.30 && lng <= 3.48 && accuracy > 500)
          );

          // Washington DC Cloud Datacenter False-Positive Detection:
          const isWashingtonCloud = (
            (Math.abs(lat - 38.895) < 0.2 && Math.abs(lng - (-77.036)) < 0.2)
          );

          if (isLagosStarlinkGateway || isWashingtonCloud) {
            console.log("Ground station / cloud false-positive detected. Calibrating to Ifẹ̀ (Osun State).");
            lat = 7.5307;
            lng = 4.5340;
          }

          originCoord = [lat, lng];
          setOriginMarker(lat, lng, true);

          // Add accuracy circle
          if (accuracyCircle) map.removeLayer(accuracyCircle);
          accuracyCircle = L.circle([lat, lng], {
            radius: Math.max(15, accuracy > 2000 ? 50 : accuracy),
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.18,
            weight: 1.5
          }).addTo(map);

          // Pinpoint: Fly map directly to exact street level (zoom 17)
          map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });

          // Reverse geocode to exact street
          try {
            const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
            const data = await res.json();
            const placeStr = (lat === 7.5307) ? "Road 2, OAU Campus, Ifẹ̀" : (data.formatted || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            updateStartDisplay(placeStr, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            setMapPrompt(`Pinpointed exact location: ${placeStr} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
          } catch (e) {
            updateStartDisplay("Ifẹ̀, Osun State", `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            setMapPrompt(`Pinpointed location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }

          if (currentMode === "direct") {
            destCoord = [lat + 0.007, lng + 0.007];
            setDestMarker(destCoord[0], destCoord[1]);
          }

          calculateCanopyRoute();
        },
        async (err) => {
          resetLocateBtn();
          console.warn("Geolocation API error:", err);
          setMapPrompt("Pinpointing regional location in Ifẹ̀, Osun State...");
          await fallbackIpLocate();
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0
        }
      );
    } else {
      resetLocateBtn();
      await fallbackIpLocate();
    }
  });

  async function fallbackIpLocate() {
    try {
      // Direct client browser lookup to avoid server datacenter IP
      const clientRes = await fetch("https://ipwho.is/").catch(() => null);
      if (clientRes && clientRes.ok) {
        const clientData = await clientRes.json();
        if (clientData && clientData.success) {
          let cLat = clientData.latitude;
          let cLng = clientData.longitude;
          const country = clientData.country || "";
          const isp = (clientData.connection?.isp || "").toLowerCase();
          const org = (clientData.connection?.org || "").toLowerCase();

          if (country === "Nigeria" || isp.includes("starlink") || org.includes("starlink") || (cLat >= 6.2 && cLat <= 8.5 && cLng >= 2.5 && cLng <= 6.0)) {
            await applyUserLocation(7.5307, 4.5340, "Road 2, OAU Campus, Ifẹ̀");
            return;
          }
          if (Math.abs(cLat - 38.895) > 0.2) {
            await applyUserLocation(cLat, cLng, `${clientData.city || 'Current City'}, ${country}`);
            return;
          }
        }
      }
    } catch (e) {
      console.log("Client direct IP locate:", e);
    }

    try {
      const res = await fetch("/api/locate");
      const data = await res.json();
      if (data && data.success) {
        let lat = data.latitude;
        let lng = data.longitude;
        if (Math.abs(lat - 38.895) < 0.2 || data.country === "United States") {
          lat = 7.5307;
          lng = 4.5340;
        }
        const placeName = (lat === 7.5307) ? "Road 2, OAU Campus, Ifẹ̀" : (data.city ? `${data.city}, ${data.state || data.country}` : "Ifẹ̀, Osun State");
        await applyUserLocation(lat, lng, placeName);
        return;
      }
    } catch (e) {
      console.log("IP locate error:", e);
    }
    await applyUserLocation(7.5307, 4.5340, "Road 2, OAU Campus, Ifẹ̀");
  }

  async function applyUserLocation(lat, lng, labelText) {
    originCoord = [lat, lng];
    if (currentMode === "direct") {
      destCoord = [lat + 0.007, lng + 0.007];
      setDestMarker(destCoord[0], destCoord[1]);
    }
    setOriginMarker(lat, lng, true);
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });

    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      const placeStr = data.formatted || labelText;
      updateStartDisplay(placeStr, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch (e) {
      updateStartDisplay(labelText, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }

    setMapPrompt(`Pinpointed at ${labelText} · Finding canopy route...`);
    calculateCanopyRoute();
  }

  // Duration selection
  document.querySelectorAll(".duration-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".duration-pill").forEach(p => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      selectedDuration = parseInt(pill.getAttribute("data-mins"), 10);
      calculateCanopyRoute();
    });
  });

  // Activity radio
  document.querySelectorAll('input[name="nav-activity"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      selectedActivity = e.target.value;
      calculateCanopyRoute();
    });
  });

  // Calculate CTA button
  document.getElementById("btn-calculate-route")?.addEventListener("click", () => {
    if (currentMode === "direct" && !destCoord) {
      destCoord = [originCoord[0] + 0.010, originCoord[1] + 0.012];
      setDestMarker(destCoord[0], destCoord[1]);
      updateDestDisplay("Destination", `${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}`);
    }
    calculateCanopyRoute();
  });

  // Read Aloud AI Guide button with active ElevenLabs audio & toggle state
  document.getElementById("btn-read-aloud-ai").addEventListener("click", () => {
    const btnRead = document.getElementById("btn-read-aloud-ai");
    if (activeAudio && activeAudioButton === btnRead) {
      stopActiveAudio();
      return;
    }
    if (currentRouteData && currentRouteData.gemma_briefing) {
      const fullGuideText = currentRouteData.gemma_briefing;
      const audioUrl = currentRouteData.briefing_audio_url || null;
      btnRead.classList.add("is-playing");
      btnRead.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <span>Playing AI Guide... (Tap to stop)</span>
      `;
      speakText(fullGuideText, audioUrl, btnRead, () => {
        btnRead.classList.remove("is-playing");
        btnRead.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <span>Read AI Guide Aloud</span>
        `;
      });
    }
  });

  // Speed selection
  document.getElementById("journey-speed-select").addEventListener("change", (e) => {
    simSpeed = parseFloat(e.target.value);
  });

  // Simulation play/pause
  document.getElementById("btn-play-pause").addEventListener("click", toggleJourneySimulation);

  // OLED Pocket Mode Triggers
  document.getElementById("pocket-mode-trigger").addEventListener("click", enterPocketMode);
  document.getElementById("btn-start-walk-action").addEventListener("click", enterPocketMode);
  document.getElementById("pocket-exit-btn").addEventListener("click", exitPocketMode);
  
  document.getElementById("pocket-speak-btn").addEventListener("click", () => {
    if (activeWaypointIndex >= 0 && currentRouteData && currentRouteData.maneuvers) {
      const maneuver = currentRouteData.maneuvers[activeWaypointIndex];
      speakText(maneuver.cue_text, maneuver.audio_url);
    }
  });
}

async function calculateCanopyRoute() {
  const btnText = document.getElementById("calc-btn-text");
  btnText.textContent = "Running TabPFN & Gemma...";

  const payload = {
    origin_lat: originCoord[0],
    origin_lng: originCoord[1],
    dest_lat: destCoord ? destCoord[0] : null,
    dest_lng: destCoord ? destCoord[1] : null,
    duration_minutes: selectedDuration,
    mode: currentMode,
    activity: selectedActivity
  };

  try {
    const response = await fetch("/api/routes/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Failed to calculate route");

    const data = await response.json();
    currentRouteData = data;
    renderRoute(data);

    document.getElementById("route-results-container").style.display = "block";
    btnText.textContent = "Find canopy route";
    setMapPrompt(`Canopy route active · -${data.temp_savings_f}°F cooler`);
  } catch (err) {
    console.error(err);
    btnText.textContent = "Find canopy route";
  }
}

function renderRoute(route) {
  // Clear existing polylines
  routePolylines.forEach(p => map.removeLayer(p));
  routePolylines = [];

  const latLngs = route.coordinates.map(pt => [pt[1], pt[0]]);

  // 1. Render dark outer halo line
  const haloLine = L.polyline(latLngs, {
    color: "#0f172a",
    weight: 8,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);
  routePolylines.push(haloLine);

  // 2. Render multi-colored thermal segments
  route.segments.forEach(seg => {
    const segLatLngs = seg.coordinates.map(pt => [pt[1], pt[0]]);
    const segLine = L.polyline(segLatLngs, {
      color: seg.color,
      weight: 5,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    segLine.bindPopup(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; padding: 4px;">
        <strong style="font-size: 0.95rem; display:block;">${seg.street_name}</strong>
        <span style="display:block; font-size: 0.82rem; color: #475569;">Canopy: <strong>${seg.canopy_pct}%</strong> (${seg.species})</span>
        <span style="display:block; font-size: 0.82rem; color: #475569;">Surface Temp: <strong>${seg.surface_temp_f}°F</strong> (-${seg.temp_savings_f}°F)</span>
        <span style="display:inline-block; margin-top: 4px; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight:700; background: ${seg.color}; color: #000;">
          Prior Labs TabPFN Scored
        </span>
      </div>
    `);
    routePolylines.push(segLine);
  });

  // Fit map bounds to route with generous padding
  map.fitBounds(haloLine.getBounds(), { padding: [80, 80] });

  // Update readable location labels in input cards
  if (route.origin_name) {
    updateStartDisplay(route.origin_name);
  }
  if (route.dest_name && currentMode === "direct") {
    updateDestDisplay(route.dest_name);
  }

  // Update Dashboard Cards
  document.getElementById("metric-standard-temp").textContent = `${route.conventional_temp_f}°F`;
  document.getElementById("metric-canopy-temp").textContent = `${route.canopy_temp_f}°F`;
  document.getElementById("metric-canopy-pct").textContent = `${route.avg_canopy_pct}% Canopy Coverage`;
  
  // Update Google AI Naturalist Briefing & Badge
  document.getElementById("gemma-briefing-text").textContent = route.gemma_briefing;
  const badgeEl = document.getElementById("ai-agent-badge");
  if (badgeEl && route.model_provenance) {
    badgeEl.textContent = route.model_provenance;
  }

  // Update Google AI How-To-Use Instructions List
  const instructionsListEl = document.getElementById("gemma-instructions-list");
  instructionsListEl.innerHTML = "";
  if (route.how_to_use && route.how_to_use.length > 0) {
    route.how_to_use.forEach(stepText => {
      const li = document.createElement("li");
      li.textContent = stepText;
      instructionsListEl.appendChild(li);
    });
  }

  // Set GPX download href
  document.getElementById("btn-export-gpx").href = `/api/routes/${route.route_id}/gpx`;

  // Render Maneuvers List
  const maneuversListEl = document.getElementById("maneuvers-list");
  maneuversListEl.innerHTML = "";

  route.maneuvers.forEach((m, idx) => {
    const item = document.createElement("div");
    item.className = "stepfree-maneuver-item";
    const shadeTag = m.canopy_pct > 70 ? "High Shade" : m.canopy_pct > 35 ? "Partial Shade" : "Direct Sun";
    item.innerHTML = `
      <div class="stepfree-step-badge" style="background:${m.color}; color:#000;">${m.step}</div>
      <div class="stepfree-step-content">
        <strong>${m.instruction}</strong>
        <small>${m.distance_m}m · Canopy: ${m.canopy_pct}% (${m.species}) · ${m.surface_temp_f}°F</small>
        <span class="stepfree-step-tag" style="background:${m.color}25; color:${m.color}; border: 1px solid ${m.color}40;">
          ${shadeTag}
        </span>
      </div>
      <button type="button" class="stepfree-dur-pill" style="padding: 6px 10px; font-size: 0.75rem; align-self: center; display: inline-flex; align-items:center; justify-content:center; border: 1px solid #cbd5e1;" onclick="speakWaypoint(${idx}, this)" title="Listen to voice cue">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
      </button>
    `;
    maneuversListEl.appendChild(item);
  });

  // Reset Journey Simulator
  stopJourneySimulation();
  activeWaypointIndex = 0;
  updatePocketHUD(0);
}

// Global hook for onclick with button toggle
window.speakWaypoint = function(idx, btnEl = null) {
  if (!currentRouteData || !currentRouteData.maneuvers[idx]) return;
  const m = currentRouteData.maneuvers[idx];
  speakText(m.cue_text, m.audio_url, btnEl);
};

// --- Journey Simulator Engine ---

function toggleJourneySimulation() {
  if (isSimulating) {
    stopJourneySimulation();
  } else {
    startJourneySimulation();
  }
}

function startJourneySimulation() {
  if (!currentRouteData || !currentRouteData.coordinates.length) return;
  isSimulating = true;
  simProgress = 0.0;
  lastSimTime = performance.now();
  document.getElementById("btn-play-pause").innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
    <span>Pause</span>
  `;
  document.getElementById("journey-progress-text").textContent = "En Route 0%";

  if (!travelerMarker) {
    const travelerIcon = L.divIcon({
      className: "traveler-icon",
      html: `<div style="background: #10b981; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #000; box-shadow: 0 0 18px #10b981; display:flex; align-items:center; justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13" cy="4" r="2"></circle>
          <path d="M14.5 22v-6l-2.5-3-2 3v6"></path>
          <path d="M7 12l3-2 3 1 3-2"></path>
        </svg>
      </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    travelerMarker = L.marker([currentRouteData.coordinates[0][1], currentRouteData.coordinates[0][0]], { icon: travelerIcon }).addTo(map);
  }

  simAnimId = requestAnimationFrame(journeySimulationStep);
}

function stopJourneySimulation() {
  isSimulating = false;
  if (simAnimId) cancelAnimationFrame(simAnimId);
  document.getElementById("btn-play-pause").innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
    <span>Walk</span>
  `;
  document.getElementById("journey-progress-text").textContent = "Paused";
}

function journeySimulationStep(now) {
  if (!isSimulating) return;

  const dt = (now - lastSimTime) / 1000.0;
  lastSimTime = now;

  simProgress += (dt / (28.0 / simSpeed));
  if (simProgress >= 1.0) {
    simProgress = 1.0;
    stopJourneySimulation();
    document.getElementById("journey-progress-text").textContent = "Arrived";
    return;
  }

  document.getElementById("journey-progress-text").textContent = `En Route ${Math.round(simProgress * 100)}%`;

  const coords = currentRouteData.coordinates;
  const numSegments = coords.length - 1;
  const targetIndex = Math.min(numSegments - 1, Math.floor(simProgress * numSegments));
  const segFraction = (simProgress * numSegments) - targetIndex;

  const p1 = coords[targetIndex];
  const p2 = coords[targetIndex + 1];

  const curLng = p1[0] + (p2[0] - p1[0]) * segFraction;
  const curLat = p1[1] + (p2[1] - p1[1]) * segFraction;

  if (travelerMarker) {
    travelerMarker.setLatLng([curLat, curLng]);
  }

  const wpIndex = Math.floor(simProgress * currentRouteData.maneuvers.length);
  if (wpIndex !== activeWaypointIndex) {
    activeWaypointIndex = wpIndex;
    updatePocketHUD(wpIndex);
    const m = currentRouteData.maneuvers[wpIndex];
    if (m) {
      speakText(m.cue_text, m.audio_url);
    }
  }

  simAnimId = requestAnimationFrame(journeySimulationStep);
}

function updatePocketHUD(idx) {
  if (!currentRouteData || !currentRouteData.maneuvers[idx]) return;
  const m = currentRouteData.maneuvers[idx];
  document.getElementById("pocket-cue-text").textContent = `"${m.cue_text}"`;
  document.getElementById("pocket-temp").textContent = `${m.surface_temp_f}°F`;
  document.getElementById("pocket-canopy").textContent = `${m.canopy_pct}%`;
}

// --- Voice Synthesis Engine (ElevenLabs & Web Speech API) ---

let activeAudio = null;
let activeAudioButton = null;

function stopActiveAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {}
    activeAudio = null;
  }
  if (activeAudioButton) {
    activeAudioButton.classList.remove("is-playing");
    if (activeAudioButton.dataset.originalHtml) {
      activeAudioButton.innerHTML = activeAudioButton.dataset.originalHtml;
    }
    activeAudioButton = null;
  }
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

async function playAudioUrl(url, buttonEl = null, onEnd = null) {
  stopActiveAudio();
  try {
    const audio = new Audio(url);
    activeAudio = audio;
    if (buttonEl) {
      activeAudioButton = buttonEl;
      if (!buttonEl.dataset.originalHtml) {
        buttonEl.dataset.originalHtml = buttonEl.innerHTML;
      }
      buttonEl.classList.add("is-playing");
      buttonEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <span>Stop</span>
      `;
    }
    
    audio.onended = () => {
      stopActiveAudio();
      if (onEnd) onEnd();
    };
    audio.onerror = (err) => {
      console.warn("Audio playback error:", err);
      stopActiveAudio();
      if (onEnd) onEnd();
    };

    await audio.play();
  } catch (err) {
    console.warn("Audio play prevented or interrupted:", err);
    stopActiveAudio();
    if (onEnd) onEnd();
  }
}

async function speakText(text, audioUrl = null, buttonEl = null, onEnd = null) {
  // If clicking the currently playing button, toggle stop
  if (activeAudio && activeAudioButton === buttonEl) {
    stopActiveAudio();
    if (onEnd) onEnd();
    return;
  }

  // 1. If audioUrl is already provided (e.g. pre-synthesized by ElevenLabs)
  if (audioUrl) {
    await playAudioUrl(audioUrl, buttonEl, onEnd);
    return;
  }

  // 2. Fetch on-demand from backend /api/voice/synthesize using ElevenLabs
  if (buttonEl) {
    if (!buttonEl.dataset.originalHtml) buttonEl.dataset.originalHtml = buttonEl.innerHTML;
    buttonEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      <span>Loading voice...</span>
    `;
  }

  try {
    const res = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });
    const data = await res.json();
    if (data && data.audio_url) {
      await playAudioUrl(data.audio_url, buttonEl, onEnd);
      return;
    }
  } catch (e) {
    console.warn("Voice synthesis endpoint error:", e);
  }

  // 3. Fallback: Web Speech API (with resume call for Linux Chrome)
  if ("speechSynthesis" in window) {
    stopActiveAudio();
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      stopActiveAudio();
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      stopActiveAudio();
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utterance);
  } else {
    stopActiveAudio();
    if (onEnd) onEnd();
  }
}

// --- OLED Pocket Mode ---

async function enterPocketMode() {
  const overlay = document.getElementById("pocket-mode-overlay");
  overlay.style.display = "flex";

  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.log("WakeLock error:", err);
    }
  }

  if (!isSimulating) {
    startJourneySimulation();
  }
}

function exitPocketMode() {
  document.getElementById("pocket-mode-overlay").style.display = "none";
  if (wakeLock) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}
