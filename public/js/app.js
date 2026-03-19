/**
 * ISS Live Tracker – Frontend
 * Leaflet.js map + Socket.IO real-time client
 */

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  lastPosition:     null,     // { lat, lng } of previous update
  following:        false,    // whether map auto-pans to ISS
  altUnit:          'km',     // 'km' | 'mi'
  velUnit:          'kmh',    // 'kmh' | 'mph'
  distanceTraveled: 0,        // km since page load
  updateCount:      0,
  isInitialCenteringDone: false, // track if we already centered once
  terminatorLayer:  null,
  dayLayer:         null,   // white brightness overlay for the day side
  terminatorActive: false
};

// ─── Map Setup ────────────────────────────────────────────────────────────────

const map = L.map('map', {
  center: [20, 0],
  zoom: 3,
  zoomControl: true,
  attributionControl: true
});

// ─── ISS Marker & Footprint ───────────────────────────────────────────────────

const issMarker = L.marker([20, 0], {
  zIndexOffset: 1000
}).addTo(map);

const footprintCircle = L.circle([20, 0], {
  radius:      2200000,   // ~2,200 km default
  color:       '#00d4ff',
  weight:      1,
  opacity:     0.5,
  fillColor:   '#00d4ff',
  fillOpacity: 0.06
}).addTo(map);

// Dark tile layer (CartoDB Dark Matter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 18
}).addTo(map);

// ─── ISS Marker Icon ─────────────────────────────────────────────────────────

/**
 * Build the SVG satellite DivIcon.
 * @param {number} bearing  – degrees, used to rotate the icon
 */
function createISSIcon(bearing = 0) {
  return L.divIcon({
    className: '',
    iconSize:  [40, 40],
    iconAnchor:[20, 20],
    html: `
      <div class="iss-marker-wrapper" style="transform: rotate(${bearing}deg)">
        <div class="iss-pulse-ring"></div>
        <div class="iss-pulse-ring"></div>
        <svg class="iss-icon-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <!-- Solar panel left -->
          <rect x="2" y="26" width="18" height="12" rx="2" fill="#00d4ff" opacity="0.85"/>
          <line x1="11" y1="26" x2="11" y2="38" stroke="#0088aa" stroke-width="1"/>
          <!-- Solar panel right -->
          <rect x="44" y="26" width="18" height="12" rx="2" fill="#00d4ff" opacity="0.85"/>
          <line x1="53" y1="26" x2="53" y2="38" stroke="#0088aa" stroke-width="1"/>
          <!-- Main truss -->
          <rect x="20" y="30" width="24" height="4" rx="1" fill="#aabbcc"/>
          <!-- Body module -->
          <rect x="25" y="23" width="14" height="18" rx="3" fill="#c0d0e8"/>
          <rect x="27" y="25" width="10" height="14" rx="2" fill="#8899bb"/>
          <!-- Docking port top -->
          <rect x="30" y="18" width="4" height="7" rx="1" fill="#99aacc"/>
          <!-- Docking port bottom -->
          <rect x="30" y="39" width="4" height="7" rx="1" fill="#99aacc"/>
          <!-- Centre glow dot -->
          <circle cx="32" cy="32" r="3" fill="#00ffff" opacity="0.9"/>
        </svg>
      </div>`
  });
}

issMarker.setIcon(createISSIcon(0));

// ─── Orbital Path Layers ──────────────────────────────────────────────────────

// Hold multi-segment polylines (antimeridian-safe)
const pathLayers = {
  past:   [],   // cyan solid segments
  future: []    // orange dashed segments
};

function clearPathLayers(type) {
  pathLayers[type].forEach(l => map.removeLayer(l));
  pathLayers[type] = [];
}

function drawPathSegments(segments, type) {
  clearPathLayers(type);
  const isPast = type === 'past';
  segments.forEach(seg => {
    if (seg.length < 2) return;
    const layer = L.polyline(seg, {
      color:     isPast ? '#00d4ff' : '#ff8c00',
      weight:    isPast ? 2 : 2,
      opacity:   isPast ? 0.65 : 0.7,
      dashArray: isPast ? null : '8, 6'
    }).addTo(map);
    pathLayers[type].push(layer);
  });
}

// ─── Utility: Haversine Distance ──────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dO = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dL/2)**2 +
             Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
             Math.sin(dO/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Utility: Bearing ─────────────────────────────────────────────────────────

function bearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const la1  = lat1 * Math.PI / 180;
  const la2  = lat2 * Math.PI / 180;
  const y    = Math.sin(dLon) * Math.cos(la2);
  const x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ─── Utility: Format Numbers ──────────────────────────────────────────────────

function fmt(n, decimals = 1) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

const $  = id => document.getElementById(id);
const el = {
  overlay:      $('loading-overlay'),
  connStatus:   $('connection-status'),
  connDot:      $('connection-status').querySelector('.conn-dot'),
  connLabel:    $('connection-status').querySelector('.conn-label'),
  utcClock:     $('utc-time'),
  lat:          $('telem-lat'),
  lon:          $('telem-lon'),
  alt:          $('telem-alt'),
  vel:          $('telem-vel'),
  vis:          $('telem-vis'),
  location:     $('telem-location'),
  distance:     $('telem-distance'),
  updates:      $('telem-updates'),
  crewList:     $('crew-list'),
  crewCount:    $('crew-count'),
  centerBtn:    $('center-btn'),
  followBtn:    $('follow-btn'),
  terminatorBtn:$('terminator-btn'),
  myLocationBtn:$('mylocation-btn'),
  passInfo:     $('pass-info'),
  sidebar:      $('sidebar'),
  sidebarToggle:$('sidebar-toggle'),
  altToggle:    $('alt-toggle'),
  velToggle:    $('vel-toggle')
};

// ─── UTC Clock ────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const h   = String(now.getUTCHours()).padStart(2, '0');
  const m   = String(now.getUTCMinutes()).padStart(2, '0');
  const s   = String(now.getUTCSeconds()).padStart(2, '0');
  el.utcClock.textContent = `UTC ${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// ─── Telemetry Display ────────────────────────────────────────────────────────

let locationCache = {};  // simple cache to avoid spamming reverse geocode

function updateTelemetry(data) {
  const lat = data.latitude;
  const lon = data.longitude;

  // Latitude
  const latDir = lat >= 0 ? 'N' : 'S';
  el.lat.textContent = `${fmt(Math.abs(lat), 4)}° ${latDir}`;

  // Longitude
  const lonDir = lon >= 0 ? 'E' : 'W';
  el.lon.textContent = `${fmt(Math.abs(lon), 4)}° ${lonDir}`;

  // Altitude
  if (state.altUnit === 'km') {
    el.alt.textContent = `${fmt(data.altitude_km)} km`;
  } else {
    el.alt.textContent = `${fmt(data.altitude_miles)} mi`;
  }

  // Velocity
  if (state.velUnit === 'kmh') {
    el.vel.textContent = `${fmt(data.velocity_kmh)} km/h`;
  } else {
    el.vel.textContent = `${fmt(data.velocity_mph)} mph`;
  }

  // Visibility
  const isDaylight = data.visibility === 'daylight';
  el.vis.textContent = isDaylight ? '🌞 Daylight' : '🌑 Eclipsed';
  el.vis.style.color = isDaylight ? '#ffdd55' : '#aabbff';
  el.vis.style.textShadow = isDaylight
    ? '0 0 8px rgba(255,221,85,0.8)'
    : '0 0 8px rgba(170,187,255,0.8)';

  // Distance & updates
  state.updateCount++;
  el.updates.textContent = state.updateCount.toLocaleString();

  if (state.lastPosition) {
    const d = haversineKm(state.lastPosition.lat, state.lastPosition.lng, lat, lon);
    state.distanceTraveled += d;
    el.distance.textContent = `${fmt(state.distanceTraveled, 0)} km`;
  }

  // Fetch location name (throttle: only when position changes significantly)
  const cacheKey = `${Math.round(lat)},${Math.round(lon)}`;
  if (locationCache[cacheKey]) {
    el.location.textContent = locationCache[cacheKey];
  } else {
    fetch(`/api/iss/location-info?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(info => {
        let loc = 'Ocean';
        if (info.ocean) loc = info.ocean;
        else if (info.country) loc = info.city ? `${info.city}, ${info.country}` : info.country;
        locationCache[cacheKey] = loc;
        el.location.textContent = loc;
      })
      .catch(() => { el.location.textContent = '--'; });
  }
}

// ─── Map Updates ──────────────────────────────────────────────────────────────

function updateMap(data) {
  const lat  = data.latitude;
  const lon  = data.longitude;
  const latlng = L.latLng(lat, lon);

  // Compute travel bearing for icon rotation
  let bear = 0;
  if (state.lastPosition) {
    bear = bearing(state.lastPosition.lat, state.lastPosition.lng, lat, lon);
  }

  issMarker.setLatLng(latlng);
  issMarker.setIcon(createISSIcon(bear));
  footprintCircle.setLatLng(latlng);

  // Footprint radius: convert km to metres
  if (data.footprint_radius_km) {
    footprintCircle.setRadius(data.footprint_radius_km * 1000);
  }

  if (state.following) {
    map.panTo(latlng, { animate: true, duration: 1.5 });
  }

  state.lastPosition = { lat, lng: lon };
}

// ─── Crew List ────────────────────────────────────────────────────────────────

function updateCrew(data) {
  const crew = data.crew || [];
  el.crewCount.textContent = crew.length;

  if (!crew.length) {
    el.crewList.innerHTML = '<li class="crew-item placeholder">No crew data available</li>';
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  el.crewList.innerHTML = crew
    .map(m => {
      const daysInSpace = m.launched ? Math.floor((now - m.launched) / 86400) : 0;
      const station = m.iss ? 'ISS' : 'TIANGONG';
      const stationClass = m.iss ? 'tag-iss' : 'tag-tiangong';
      
      return `
        <a class="crew-card" href="${m.url || '#'}" target="_blank" rel="noopener noreferrer">
          <div class="crew-photo-container">
            ${m.image 
              ? `<img class="crew-photo" src="${m.image}" alt="${m.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">` 
              : ''}
            <span class="crew-photo-placeholder" style="${m.image ? 'display:none' : 'display:block'}">👨‍🚀</span>
          </div>
          <div class="crew-info">
            <div class="crew-header">
              <span class="crew-name">${m.name}</span>
              ${m.flag_code ? `<img class="crew-flag" src="https://flagcdn.com/${m.flag_code.toLowerCase()}.svg" alt="${m.country}">` : ''}
            </div>
            <span class="crew-role">${m.position || 'Astronaut'}</span>
            <div class="crew-meta">
              <span class="crew-spacecraft">🚀 ${m.spacecraft || 'Unknown'}</span>
              <span class="crew-duration">⏳ ${daysInSpace} days</span>
            </div>
            <div class="crew-tags">
              <span class="crew-tag ${stationClass}">${station}</span>
              ${m.agency ? `<span class="crew-tag tag-agency">${m.agency}</span>` : ''}
            </div>
          </div>
        </a>
      `;
    })
    .join('');
}

// ─── Socket.IO Client ─────────────────────────────────────────────────────────

const socket = io({ transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  el.connStatus.className = 'conn-status connected';
  el.connLabel.textContent = 'LIVE';
  console.log('[Socket.IO] Connected:', socket.id);
});

socket.on('disconnect', () => {
  el.connStatus.className = 'conn-status disconnected';
  el.connLabel.textContent = 'OFFLINE';
  console.log('[Socket.IO] Disconnected');
});

socket.on('iss:position', (data) => {
  // Dismiss loading overlay on first position
  if (el.overlay && !el.overlay.classList.contains('hidden')) {
    el.overlay.classList.add('hidden');
  }

  // Initial Auto-Center logic
  if (!state.isInitialCenteringDone) {
    const latlng = L.latLng(data.latitude, data.longitude);
    
    // Position the marker/circle first so bounds are correct
    issMarker.setLatLng(latlng);
    footprintCircle.setLatLng(latlng);
    if (data.footprint_radius_km) {
      footprintCircle.setRadius(data.footprint_radius_km * 1000);
    }

    // Center and fit zoom to the visibility footprint
    map.panTo(latlng, { animate: true, duration: 1.5 });
    map.fitBounds(footprintCircle.getBounds(), { padding: [20, 20] });
    
    state.isInitialCenteringDone = true;
  }

  updateTelemetry(data);
  updateMap(data);
});

socket.on('iss:orbital-path', (data) => {
  if (data.past)   drawPathSegments(data.past,   'past');
  if (data.future) drawPathSegments(data.future, 'future');
});

socket.on('iss:astronauts', updateCrew);

socket.on('iss:error', (err) => {
  console.warn('[ISS Error]', err.source, err.message);
});

// ─── Control Buttons ──────────────────────────────────────────────────────────

// Center on ISS
el.centerBtn.addEventListener('click', () => {
  if (state.lastPosition) {
    map.flyTo([state.lastPosition.lat, state.lastPosition.lng], 4, {
      animate: true, duration: 1.2
    });
  }
});

// Follow ISS toggle
el.followBtn.addEventListener('click', () => {
  state.following = !state.following;
  el.followBtn.classList.toggle('active', state.following);
  el.followBtn.textContent = state.following ? '⏸ Following' : '▶ Follow ISS';
});

// Day/Night terminator toggle
el.terminatorBtn.addEventListener('click', () => {
  state.terminatorActive = !state.terminatorActive;
  el.terminatorBtn.classList.toggle('active', state.terminatorActive);
  el.terminatorBtn.textContent = state.terminatorActive ? '☀️ Day/Night' : '🌒 Day/Night';

  if (state.terminatorActive) {
    if (typeof L.terminator === 'function') {
      // 1) Bright white tint over the entire world → makes the day side look light/white
      state.dayLayer = L.rectangle([[-90, -180], [90, 180]], {
        fillColor:   '#ffffff',
        fillOpacity: 0.32,
        stroke:      false,
        interactive: false
      }).addTo(map);

      // 2) Dark terminator polygon sits on top → night side becomes very dark
      //    The dark fill (80% opacity) easily overpowers the white day layer beneath it.
      state.terminatorLayer = L.terminator({
        fillColor:   '#000820',
        fillOpacity: 0.82,
        color:       '#ffd04d',   // bright golden dawn/dusk line
        weight:      2.5,
        opacity:     0.92
      }).addTo(map);

      // Update terminator position every 60 seconds
      state.terminatorInterval = setInterval(() => {
        if (state.terminatorLayer) state.terminatorLayer.setTime(new Date());
      }, 60000);
    }
  } else {
    if (state.dayLayer) {
      map.removeLayer(state.dayLayer);
      state.dayLayer = null;
    }
    if (state.terminatorLayer) {
      map.removeLayer(state.terminatorLayer);
      state.terminatorLayer = null;
    }
    clearInterval(state.terminatorInterval);
  }
});

// Unit toggles
el.altToggle.addEventListener('click', () => {
  state.altUnit = state.altUnit === 'km' ? 'mi' : 'km';
});

el.velToggle.addEventListener('click', () => {
  state.velUnit = state.velUnit === 'kmh' ? 'mph' : 'kmh';
});

// Mobile sidebar toggle
el.sidebarToggle.addEventListener('click', () => {
  el.sidebar.classList.toggle('open');
});

// ─── My Location / Next ISS Pass ──────────────────────────────────────────────

el.myLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    el.passInfo.innerHTML = '<span style="color:#ff4060">Geolocation not supported</span>';
    return;
  }

  el.myLocationBtn.textContent = '📍 Locating…';
  el.myLocationBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    el.myLocationBtn.textContent = '📍 Computing passes…';

    try {
      const res  = await fetch(`/api/iss/passes?lat=${lat}&lon=${lon}`);
      const data = await res.json();

      if (!data.passes || !data.passes.length) {
        el.passInfo.innerHTML = '<span class="pass-placeholder">No visible passes found in next 7 days</span>';
      } else {
        el.passInfo.innerHTML = data.passes.slice(0, 3).map(p => {
          const rise = new Date(p.riseTime);
          const timeStr = rise.toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
          });
          return `
            <div class="pass-item">
              <div class="pass-time">${timeStr}</div>
              <div>Max elevation: <span class="pass-el">${p.maxElevation}°</span></div>
              <div>Duration: ${Math.floor(p.duration / 60)}m ${p.duration % 60}s</div>
            </div>`;
        }).join('');
      }
    } catch (err) {
      el.passInfo.innerHTML = '<span style="color:#ff4060">Failed to fetch pass data</span>';
    }

    el.myLocationBtn.textContent = '📍 Use My Location';
    el.myLocationBtn.disabled = false;
  }, (err) => {
    el.passInfo.innerHTML = `<span style="color:#ff4060">Location denied: ${err.message}</span>`;
    el.myLocationBtn.textContent = '📍 Use My Location';
    el.myLocationBtn.disabled = false;
  });
});

// ─── Map Click: close mobile sidebar ─────────────────────────────────────────

map.on('click', () => {
  if (window.innerWidth <= 768) {
    el.sidebar.classList.remove('open');
  }
});

// Disable follow mode on manual map interaction
map.on('movestart', (e) => {
  // Check if the move was triggered by user (not by panTo/flyTo)
  // Leaflet doesn't provide a direct "isUserTriggered" flag in movestart,
  // but we can check if it was triggered by our own panTo calls.
  // Actually, a simpler way is to check if it was a drag, zoom, etc.
  if (state.following) {
    // We only disable if it's NOT a programmatic move.
    // In Leaflet, programmatic moves like panTo don't have an 'originalEvent'.
  }
});

// A more robust way to detect manual interaction is to listen to specific user events
map.on('dragstart zoomstart', () => {
  if (state.following) {
    state.following = false;
    el.followBtn.classList.remove('active');
    el.followBtn.textContent = '▶ Follow ISS';
  }
});

// Expose state and other objects for testing if in a test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { state, map, issMarker, footprintCircle };
}

