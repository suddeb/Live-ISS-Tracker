/**
 * ISS Live Tracker – Frontend
 * Leaflet.js map + Socket.IO real-time client
 */

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * @description Global application state shared across all UI and map update functions.
 *
 * @property {?{lat: number, lng: number}} lastPosition - Coordinates of the previous ISS update; null before the first update.
 * @property {boolean} following - Whether the map auto-pans to track the ISS on each position update.
 * @property {'km'|'mi'} altUnit - Display unit for altitude.
 * @property {'kmh'|'mph'} velUnit - Display unit for velocity.
 * @property {number} distanceTraveled - Cumulative great-circle distance (km) traveled since page load.
 * @property {number} updateCount - Total number of `iss:position` events received this session.
 * @property {boolean} isInitialCenteringDone - Guards the one-time auto-center + zoom-to-footprint on first fix.
 * @property {?L.Layer} terminatorLayer - Active Leaflet.Terminator night-side polygon, or null when disabled.
 * @property {?L.Rectangle} dayLayer - White brightness overlay covering the full world on the day side, or null when disabled.
 * @property {boolean} terminatorActive - Whether the day/night terminator overlay is currently shown.
 */
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

/**
 * @description Leaflet map instance centred on [20, 0] at zoom 3.
 * Rendered into the `#map` DOM element.
 * @type {L.Map}
 */
const map = L.map('map', {
  center: [20, 0],
  zoom: 3,
  zoomControl: true,
  attributionControl: true
});

// ─── ISS Marker & Footprint ───────────────────────────────────────────────────

/**
 * @description Leaflet marker representing the current ISS position.
 * Icon is replaced on every position update via {@link createISSIcon}.
 * @type {L.Marker}
 */
const issMarker = L.marker([20, 0], {
  zIndexOffset: 1000
}).addTo(map);

/**
 * @description Circle overlay visualising the ISS radio/visibility footprint.
 * Radius is updated from `footprint_radius_km` in each position payload.
 * @type {L.Circle}
 */
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
 * @description Builds a Leaflet `DivIcon` containing an inline SVG of the ISS
 * rotated to match its current travel bearing. Two animated pulse rings are
 * included for visual flair.
 *
 * @param {number} [bearing=0] - Clockwise rotation in degrees (0 = north-up).
 * @returns {L.DivIcon} A 40×40 pixel icon anchored at its centre.
 *
 * @example
 * // Point the icon north-east
 * issMarker.setIcon(createISSIcon(45));
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

/**
 * @description Stores active multi-segment polylines for the past and predicted
 * future orbital paths. Segments are kept separate to handle antimeridian
 * wrapping without distorting the lines.
 *
 * @type {{ past: L.Polyline[], future: L.Polyline[] }}
 */
// Hold multi-segment polylines (antimeridian-safe)
const pathLayers = {
  past:   [],   // cyan solid segments
  future: []    // orange dashed segments
};

/**
 * @description Removes all polylines of the given type from the map and clears
 * the corresponding array in {@link pathLayers}.
 *
 * @param {'past'|'future'} type - Which set of path layers to clear.
 *
 * @example
 * clearPathLayers('past');
 */
function clearPathLayers(type) {
  pathLayers[type].forEach(l => map.removeLayer(l));
  pathLayers[type] = [];
}

/**
 * @description Replaces the polylines for a given path type with new segments
 * received from the server. Past segments are rendered as solid cyan lines;
 * future segments as dashed orange lines.
 *
 * Each segment is an array of `[lat, lng]` pairs. Segments with fewer than
 * two points are skipped to avoid degenerate polylines.
 *
 * @param {Array<Array<[number, number]>>} segments - Antimeridian-safe path segments.
 * @param {'past'|'future'} type - Whether these are past-track or predicted-future segments.
 *
 * @example
 * drawPathSegments(data.past, 'past');
 * drawPathSegments(data.future, 'future');
 */
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

/**
 * @description Computes the great-circle distance between two geographic points
 * using the Haversine formula. Suitable for the short inter-update distances
 * produced by ISS telemetry (typically < 100 km between ticks).
 *
 * @param {number} lat1 - Latitude of point A in decimal degrees.
 * @param {number} lon1 - Longitude of point A in decimal degrees.
 * @param {number} lat2 - Latitude of point B in decimal degrees.
 * @param {number} lon2 - Longitude of point B in decimal degrees.
 * @returns {number} Distance in kilometres.
 *
 * @example
 * const km = haversineKm(51.5, -0.1, 48.8, 2.3); // London → Paris ≈ 340 km
 */
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

/**
 * @description Calculates the initial bearing (forward azimuth) from point A to
 * point B on the surface of a sphere. Used to orient the ISS marker icon so it
 * points in the direction of travel.
 *
 * @param {number} lat1 - Latitude of the origin point in decimal degrees.
 * @param {number} lon1 - Longitude of the origin point in decimal degrees.
 * @param {number} lat2 - Latitude of the destination point in decimal degrees.
 * @param {number} lon2 - Longitude of the destination point in decimal degrees.
 * @returns {number} Bearing in degrees, normalised to [0, 360).
 *
 * @example
 * const deg = bearing(51.5, -0.1, 48.8, 2.3); // ≈ 156° (south-east)
 */
function bearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const la1  = lat1 * Math.PI / 180;
  const la2  = lat2 * Math.PI / 180;
  const y    = Math.sin(dLon) * Math.cos(la2);
  const x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ─── Utility: Format Numbers ──────────────────────────────────────────────────

/**
 * @description Formats a number for display using the `en-US` locale with a
 * configurable maximum number of decimal places. Adds thousands separators
 * automatically (e.g. `7826.1` → `"7,826.1"`).
 *
 * @param {number} n - The number to format.
 * @param {number} [decimals=1] - Maximum number of fractional digits to show.
 * @returns {string} Locale-formatted string.
 *
 * @example
 * fmt(27600.5);    // "27,600.5"
 * fmt(408.2, 0);   // "408"
 */
function fmt(n, decimals = 1) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

/**
 * @description Shorthand alias for `document.getElementById`.
 * @param {string} id - The element ID to look up.
 * @returns {HTMLElement|null} The matching element, or null if not found.
 */
const $  = id => document.getElementById(id);

/**
 * @description Cached references to frequently updated DOM elements, keyed by
 * semantic name. Populated once at startup to avoid repeated `getElementById`
 * calls during high-frequency telemetry updates.
 *
 * @type {{
 *   overlay:       HTMLElement,
 *   connStatus:    HTMLElement,
 *   connDot:       HTMLElement,
 *   connLabel:     HTMLElement,
 *   utcClock:      HTMLElement,
 *   lat:           HTMLElement,
 *   lon:           HTMLElement,
 *   alt:           HTMLElement,
 *   vel:           HTMLElement,
 *   vis:           HTMLElement,
 *   location:      HTMLElement,
 *   distance:      HTMLElement,
 *   updates:       HTMLElement,
 *   crewList:      HTMLElement,
 *   crewCount:     HTMLElement,
 *   centerBtn:     HTMLButtonElement,
 *   followBtn:     HTMLButtonElement,
 *   terminatorBtn: HTMLButtonElement,
 *   myLocationBtn: HTMLButtonElement,
 *   passInfo:      HTMLElement,
 *   sidebar:       HTMLElement,
 *   sidebarToggle: HTMLButtonElement,
 *   altToggle:     HTMLButtonElement,
 *   velToggle:     HTMLButtonElement
 * }}
 */
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

/**
 * @description Reads the current wall-clock time, formats it as `UTC HH:MM:SS`,
 * and writes it to the `#utc-time` element. Called immediately at startup and
 * then every second via `setInterval`.
 *
 * @returns {void}
 *
 * @example
 * updateClock(); // Sets #utc-time to e.g. "UTC 14:07:03"
 */
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

/**
 * @description Simple in-memory cache that maps rounded `"lat,lon"` grid keys to
 * resolved place name strings, preventing redundant reverse-geocode requests when
 * the ISS stays within the same 1° cell.
 * @type {Object.<string, string>}
 */
let locationCache = {};  // simple cache to avoid spamming reverse geocode

/**
 * @description Updates all telemetry sidebar fields from a position payload
 * emitted by the server on the `iss:position` Socket.IO event.
 *
 * Side-effects:
 * - Reads `state.altUnit` / `state.velUnit` to choose the correct display unit.
 * - Increments `state.updateCount` and accumulates `state.distanceTraveled`.
 * - Fires a `GET /api/iss/location-info` request when the rounded grid cell
 *   changes, using `locationCache` to de-duplicate identical cells.
 *
 * @param {{
 *   latitude:        number,
 *   longitude:       number,
 *   altitude_km:     number,
 *   altitude_miles:  number,
 *   velocity_kmh:    number,
 *   velocity_mph:    number,
 *   visibility:      'daylight'|'eclipsed'
 * }} data - ISS telemetry payload from the server.
 * @returns {void}
 */
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

/**
 * @description Moves the ISS marker, footprint circle, and (when follow mode is
 * active) the map viewport to the latest ISS position. Also rotates the marker
 * icon to reflect the computed travel bearing from the previous fix.
 *
 * @param {{
 *   latitude:            number,
 *   longitude:           number,
 *   footprint_radius_km: number|undefined
 * }} data - ISS position payload; `footprint_radius_km` is optional.
 * @returns {void}
 */
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

/**
 * @description Renders the crew panel from the astronaut payload emitted on the
 * `iss:astronauts` Socket.IO event. Crew members are grouped by agency and
 * sorted NASA → Roscosmos/RSA → others alphabetically. Each card links to the
 * astronaut's biography page and shows their photo, role, spacecraft, days in
 * space, and nationality flag.
 *
 * @param {{
 *   crew: Array<{
 *     name:       string,
 *     agency:     string,
 *     position:   string|undefined,
 *     spacecraft: string|undefined,
 *     launched:   number|undefined,
 *     iss:        boolean,
 *     image:      string|undefined,
 *     url:        string|undefined,
 *     flag_code:  string|undefined,
 *     country:    string|undefined
 *   }>
 * }} data - Astronaut payload; `crew` defaults to an empty array when absent.
 * @returns {void}
 */
function updateCrew(data) {
  const crew = data.crew || [];
  el.crewCount.textContent = crew.length;

  if (!crew.length) {
    el.crewList.innerHTML = '<li class="crew-item placeholder">No crew data available</li>';
    return;
  }

  // Define agency branding (icons/emojis)
  const agencyMeta = {
    'NASA':      { icon: '🇺🇸', tag: 'tag-nasa' },
    'Roscosmos': { icon: '🇷🇺', tag: 'tag-rsa' },
    'RSA':       { icon: '🇷🇺', tag: 'tag-rsa' },
    'ESA':       { icon: '🇪🇺', tag: 'tag-esa' },
    'CMSA':      { icon: '🇨🇳', tag: 'tag-cmsa' },
    'JAXA':      { icon: '🇯🇵', tag: 'tag-jaxa' },
    'SpaceX':    { icon: '🚀', tag: 'tag-agency' },
    'Axiom':     { icon: '🛰️', tag: 'tag-agency' }
  };

  const now = Math.floor(Date.now() / 1000);

  // Group crew by agency
  const groups = crew.reduce((acc, member) => {
    const agency = member.agency || 'Other';
    if (!acc[agency]) acc[agency] = [];
    acc[agency].push(member);
    return acc;
  }, {});

  // Sort agencies: NASA first, Roscosmos second, others alphabetical
  const sortedAgencies = Object.keys(groups).sort((a, b) => {
    if (a === 'NASA') return -1;
    if (b === 'NASA') return 1;
    if (a === 'Roscosmos' || a === 'RSA') return -1;
    if (b === 'Roscosmos' || b === 'RSA') return 1;
    return a.localeCompare(b);
  });

  el.crewList.innerHTML = sortedAgencies
    .map(agency => {
      const meta = agencyMeta[agency] || { icon: '👨‍🚀', tag: 'tag-agency' };
      const members = groups[agency];

      const groupHtml = members
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
                  <span class="crew-tag ${meta.tag}">${agency}</span>
                </div>
              </div>
            </a>
          `;
        })
        .join('');

      return `
        <div class="agency-group">
          <div class="agency-header">
            <span class="agency-icon">${meta.icon}</span>
            <span class="agency-label">${agency}</span>
          </div>
          <div class="crew-list">
            ${groupHtml}
          </div>
        </div>
      `;
    })
    .join('');
}

// ─── Socket.IO Client ─────────────────────────────────────────────────────────

/**
 * @description Socket.IO client instance. Prefers WebSocket transport with a
 * long-polling fallback.
 * @type {import('socket.io-client').Socket}
 */
const socket = io({ transports: ['websocket', 'polling'] });

/**
 * @description Fired when the Socket.IO connection is established or re-established.
 * Updates the connection status badge to green / "LIVE".
 */
socket.on('connect', () => {
  el.connStatus.className = 'conn-status connected';
  el.connLabel.textContent = 'LIVE';
  console.log('[Socket.IO] Connected:', socket.id);
});

/**
 * @description Fired when the Socket.IO connection is lost.
 * Updates the connection status badge to red / "OFFLINE".
 */
socket.on('disconnect', () => {
  el.connStatus.className = 'conn-status disconnected';
  el.connLabel.textContent = 'OFFLINE';
  console.log('[Socket.IO] Disconnected');
});

/**
 * @description Handles incoming ISS position updates from the server.
 *
 * On the very first event the loading overlay is hidden and the map is
 * auto-centred + zoomed to fit the visibility footprint. Subsequent events
 * update telemetry and move the marker.
 *
 * @param {{
 *   latitude:            number,
 *   longitude:           number,
 *   altitude_km:         number,
 *   altitude_miles:      number,
 *   velocity_kmh:        number,
 *   velocity_mph:        number,
 *   visibility:          'daylight'|'eclipsed',
 *   footprint_radius_km: number|undefined
 * }} data - ISS position payload.
 */
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

/**
 * @description Handles incoming orbital path data and redraws the past-track and
 * predicted-future polylines on the map.
 *
 * @param {{
 *   past:   Array<Array<[number, number]>>|undefined,
 *   future: Array<Array<[number, number]>>|undefined
 * }} data - Orbital path payload; either key may be absent.
 */
socket.on('iss:orbital-path', (data) => {
  if (data.past)   drawPathSegments(data.past,   'past');
  if (data.future) drawPathSegments(data.future, 'future');
});

/**
 * @description Handles incoming astronaut roster updates and re-renders the crew panel.
 *
 * @see updateCrew
 */
socket.on('iss:astronauts', updateCrew);

/**
 * @description Logs server-side ISS data errors to the console for debugging.
 *
 * @param {{ source: string, message: string }} err - Error descriptor from the server.
 */
socket.on('iss:error', (err) => {
  console.warn('[ISS Error]', err.source, err.message);
});

// ─── Control Buttons ──────────────────────────────────────────────────────────

/**
 * @description Flies the map to the last known ISS position at zoom 4 when the
 * "Center ISS" button is clicked. No-ops if no position has been received yet.
 */
el.centerBtn.addEventListener('click', () => {
  if (state.lastPosition) {
    map.flyTo([state.lastPosition.lat, state.lastPosition.lng], 4, {
      animate: true, duration: 1.2
    });
  }
});

/**
 * @description Toggles auto-follow mode. When active the map pans to the ISS on
 * every `iss:position` event. Button text and CSS class update to reflect state.
 */
el.followBtn.addEventListener('click', () => {
  state.following = !state.following;
  el.followBtn.classList.toggle('active', state.following);
  el.followBtn.textContent = state.following ? '⏸ Following' : '▶ Follow ISS';
});

/**
 * @description Toggles the day/night terminator overlay.
 *
 * When activated:
 * 1. A semi-transparent white rectangle covers the entire world to brighten the day side.
 * 2. A `L.terminator` polygon darkens the night side with a golden dawn/dusk boundary line.
 * 3. A 60-second interval keeps the terminator position current.
 *
 * When deactivated both layers are removed from the map and the interval is cleared.
 * Gracefully no-ops if `L.terminator` is unavailable (plugin not loaded).
 */
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

/**
 * @description Cycles the altitude display unit between `'km'` and `'mi'`.
 * The next `updateTelemetry` call will render the new unit automatically.
 */
el.altToggle.addEventListener('click', () => {
  state.altUnit = state.altUnit === 'km' ? 'mi' : 'km';
});

/**
 * @description Cycles the velocity display unit between `'kmh'` and `'mph'`.
 * The next `updateTelemetry` call will render the new unit automatically.
 */
el.velToggle.addEventListener('click', () => {
  state.velUnit = state.velUnit === 'kmh' ? 'mph' : 'kmh';
});

/**
 * @description Toggles the `open` CSS class on the sidebar element, showing or
 * hiding the telemetry panel on narrow (mobile) viewports.
 */
el.sidebarToggle.addEventListener('click', () => {
  el.sidebar.classList.toggle('open');
});

// ─── My Location / Next ISS Pass ──────────────────────────────────────────────

/**
 * @description Requests the user's geolocation, then fetches the next three ISS
 * visible passes from `GET /api/iss/passes` and renders them in `#pass-info`.
 *
 * The button is disabled during the asynchronous operation and re-enabled when
 * complete. Error states (geolocation denied, fetch failure, no passes found)
 * are surfaced inline in the `#pass-info` element.
 */
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

/**
 * @description Closes the sidebar when the user taps the map on viewports
 * narrower than 768 px, restoring full-screen map visibility on mobile.
 */
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

/**
 * @description Cancels auto-follow mode when the user manually drags or zooms
 * the map, preventing the viewport from snapping back to the ISS on the next
 * position update.
 */
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
