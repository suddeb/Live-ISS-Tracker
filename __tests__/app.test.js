/**
 * @jest-environment jsdom
 *
 * Tests for public/js/app.js
 *
 * Strategy:
 *  - Pure utility functions (haversineKm, bearing, fmt) are re-defined here and
 *    tested in isolation — they are not exported by the module.
 *  - All browser globals (L, io, fetch, navigator.geolocation) are mocked before
 *    the module is required so that the top-level initialisation code runs cleanly.
 *  - The DOM is built with buildDOM() before require() so that the `el` references
 *    inside the module resolve to real elements.
 *  - Socket event handlers are retrieved from mockSocketInstance.on.mock.calls.
 *  - Map event handlers are retrieved from mockMapInstance.on.mock.calls.
 *  - Button handlers are exercised via element.click().
 */

'use strict';

// ─── DOM Setup ────────────────────────────────────────────────────────────────

function buildDOM() {
  document.body.innerHTML = `
    <div id="map"></div>
    <div id="loading-overlay"></div>
    <div id="connection-status">
      <span class="conn-dot"></span>
      <span class="conn-label">CONNECTING</span>
    </div>
    <span id="utc-time"></span>
    <span id="telem-lat"></span>
    <span id="telem-lon"></span>
    <span id="telem-alt"></span>
    <span id="telem-vel"></span>
    <span id="telem-vis"></span>
    <span id="telem-location"></span>
    <span id="telem-distance"></span>
    <span id="telem-updates"></span>
    <ul  id="crew-list"></ul>
    <span id="crew-count"></span>
    <button id="center-btn"></button>
    <button id="follow-btn">&#9654; Follow ISS</button>
    <button id="terminator-btn">&#127762; Day/Night</button>
    <button id="mylocation-btn">&#128205; Use My Location</button>
    <div  id="pass-info"></div>
    <div  id="sidebar"></div>
    <button id="sidebar-toggle"></button>
    <button id="alt-toggle"></button>
    <button id="vel-toggle"></button>
  `;
}

// ─── Leaflet Mocks ────────────────────────────────────────────────────────────

const mockMapInstance = {
  addLayer:    jest.fn(),
  removeLayer: jest.fn(),
  panTo:       jest.fn(),
  flyTo:       jest.fn(),
  fitBounds:   jest.fn(),
  on:          jest.fn()
};

const mockMarkerInstance = {
  addTo:    jest.fn().mockReturnThis(),
  setLatLng: jest.fn(),
  setIcon:   jest.fn()
};

const mockCircleInstance = {
  addTo:    jest.fn().mockReturnThis(),
  setLatLng: jest.fn(),
  setRadius: jest.fn(),
  getBounds: jest.fn().mockReturnValue({})
};

const mockRectInstance = {
  addTo: jest.fn().mockReturnThis()
};

const mockTerminatorInstance = {
  addTo:   jest.fn().mockReturnThis(),
  setTime: jest.fn()
};

global.L = {
  map:        jest.fn().mockReturnValue(mockMapInstance),
  marker:     jest.fn().mockReturnValue(mockMarkerInstance),
  circle:     jest.fn().mockReturnValue(mockCircleInstance),
  tileLayer:  jest.fn().mockReturnValue({ addTo: jest.fn() }),
  // Each polyline() call returns a fresh object so individual instances can be
  // tracked (clearPathLayers removes them by reference).
  polyline:   jest.fn(() => {
    const layer = { addTo: jest.fn() };
    layer.addTo.mockReturnValue(layer);
    return layer;
  }),
  divIcon:    jest.fn(opts => ({ className: opts.className, iconSize: opts.iconSize, html: opts.html })),
  latLng:     jest.fn((lat, lng) => ({ lat, lng })),
  rectangle:  jest.fn().mockReturnValue(mockRectInstance),
  terminator: jest.fn().mockReturnValue(mockTerminatorInstance)
};

// ─── Socket.IO Mock ───────────────────────────────────────────────────────────

const mockSocketInstance = { on: jest.fn(), id: 'mock-socket-001' };
global.io = jest.fn().mockReturnValue(mockSocketInstance);

// ─── Fetch Mock ───────────────────────────────────────────────────────────────

global.fetch = jest.fn();

// ─── Geolocation Mock ─────────────────────────────────────────────────────────

const mockGetCurrentPosition = jest.fn();
Object.defineProperty(global.navigator, 'geolocation', {
  value: { getCurrentPosition: mockGetCurrentPosition },
  configurable: true,
  writable: true
});

// ─── Fake Timers (setInterval for the clock and terminator) ───────────────────

// Do not fake nextTick so that Promise-flush helpers can drain microtasks.
jest.useFakeTimers({ doNotFake: ['nextTick'] });

// Drains all pending Promise microtasks and nextTick callbacks.
const flushPromises = () => new Promise(resolve => process.nextTick(resolve));

// ─── Load Module (DOM + globals must be ready first) ─────────────────────────

buildDOM();
const { state } = require('../public/js/app');

// ─── Retrieval Helpers ────────────────────────────────────────────────────────

function getSocketHandler(event) {
  const match = mockSocketInstance.on.mock.calls.find(([ev]) => ev === event);
  if (!match) throw new Error(`No socket handler registered for '${event}'`);
  return match[1];
}

function getMapHandler(event) {
  const match = mockMapInstance.on.mock.calls.find(([ev]) => ev === event);
  if (!match) throw new Error(`No map handler registered for '${event}'`);
  return match[1];
}

function click(id) {
  document.getElementById(id).click();
}

// ─── Shared Position Payload ──────────────────────────────────────────────────

const BASE_POSITION = {
  latitude:            51.5074,
  longitude:          -0.1278,
  altitude_km:         408.2,
  altitude_miles:      253.6,
  velocity_kmh:        27580,
  velocity_mph:        17136,
  visibility:          'daylight',
  footprint_radius_km: 2200
};

// =============================================================================
// Pure Utility Functions
// (Re-implemented here because the module does not export them.)
// =============================================================================

describe('haversineKm', () => {
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R  = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dO = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(dL / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dO / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  it('returns 0 for identical points', () => {
    expect(haversineKm(0, 0, 0, 0)).toBeCloseTo(0, 5);
  });

  it('calculates London → Paris (~340 km)', () => {
    const d = haversineKm(51.5, -0.1, 48.85, 2.35);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(345);
  });

  it('is symmetric — A→B equals B→A', () => {
    const d1 = haversineKm(40, -74, 51.5, -0.1);
    const d2 = haversineKm(51.5, -0.1, 40, -74);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('handles antipodal points (~20 015 km)', () => {
    const d = haversineKm(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThan(20100);
  });

  it('handles southern hemisphere coordinates', () => {
    const d = haversineKm(-33.87, 151.2, -36.84, 174.76); // Sydney → Auckland
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(2300);
  });

  it('returns a positive number for any two distinct points', () => {
    expect(haversineKm(0, 0, 1, 1)).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------

describe('bearing', () => {
  function bearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const la1  = lat1 * Math.PI / 180;
    const la2  = lat2 * Math.PI / 180;
    const y    = Math.sin(dLon) * Math.cos(la2);
    const x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  it('due north → 0°', () => {
    expect(bearing(0, 0, 10, 0)).toBeCloseTo(0, 0);
  });

  it('due east → ~90°', () => {
    expect(bearing(0, 0, 0, 10)).toBeCloseTo(90, 0);
  });

  it('due south → ~180°', () => {
    expect(bearing(10, 0, 0, 0)).toBeCloseTo(180, 0);
  });

  it('due west → ~270°', () => {
    expect(bearing(0, 10, 0, 0)).toBeCloseTo(270, 0);
  });

  it('result is always in [0, 360)', () => {
    const angles = [
      bearing(51.5, -0.1, 48.85, 2.35),
      bearing(-33.87, 151.2, 35.68, 139.7),
      bearing(0, 170, 0, -170)
    ];
    angles.forEach(b => {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    });
  });
});

// -----------------------------------------------------------------------------

describe('fmt', () => {
  function fmt(n, decimals = 1) {
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
  }

  it('formats zero', () => {
    expect(fmt(0)).toBe('0');
  });

  it('adds thousands separators', () => {
    expect(fmt(27600.5)).toBe('27,600.5');
  });

  it('defaults to 1 decimal place', () => {
    expect(fmt(408.27)).toBe('408.3');
  });

  it('respects decimals=0', () => {
    expect(fmt(408.27, 0)).toBe('408');
  });

  it('respects decimals=2', () => {
    expect(fmt(408.27, 2)).toBe('408.27');
  });

  it('handles large integers', () => {
    expect(fmt(1000000, 0)).toBe('1,000,000');
  });

  it('handles negative numbers', () => {
    expect(fmt(-1234.5)).toBe('-1,234.5');
  });

  it('coerces string-numbers', () => {
    expect(fmt('7826.1')).toBe('7,826.1');
  });
});

// =============================================================================
// Module Initialisation
// =============================================================================

describe('Module initialisation', () => {
  it('creates the Leaflet map centred at [20, 0] with zoom 3', () => {
    expect(L.map).toHaveBeenCalledWith('map', expect.objectContaining({
      center: [20, 0],
      zoom:   3
    }));
  });

  it('places the ISS marker at [20, 0]', () => {
    expect(L.marker).toHaveBeenCalledWith([20, 0], expect.any(Object));
  });

  it('adds the marker to the map', () => {
    expect(mockMarkerInstance.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  it('creates the footprint circle with the correct colour', () => {
    expect(L.circle).toHaveBeenCalledWith([20, 0], expect.objectContaining({ color: '#00d4ff' }));
  });

  it('adds the footprint circle to the map', () => {
    expect(mockCircleInstance.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  it('sets the initial ISS icon', () => {
    expect(L.divIcon).toHaveBeenCalled();
    expect(mockMarkerInstance.setIcon).toHaveBeenCalled();
  });

  it('initialises Socket.IO with websocket transport', () => {
    expect(io).toHaveBeenCalledWith(expect.objectContaining({
      transports: ['websocket', 'polling']
    }));
  });

  it('state defaults are correct', () => {
    expect(state.following).toBe(false);
    expect(state.altUnit).toBe('km');
    expect(state.velUnit).toBe('kmh');
    expect(state.distanceTraveled).toBe(0);
    expect(state.terminatorActive).toBe(false);
    expect(state.terminatorLayer).toBeNull();
    expect(state.dayLayer).toBeNull();
  });
});

// =============================================================================
// createISSIcon (tested indirectly via L.divIcon calls inside updateMap)
// =============================================================================

describe('createISSIcon (via updateMap)', () => {
  const positionHandler = () => getSocketHandler('iss:position');

  beforeEach(() => {
    L.divIcon.mockClear();
    mockMarkerInstance.setIcon.mockClear();
    state.isInitialCenteringDone = true;
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({})
    });
  });

  it('produces a 40×40 DivIcon', () => {
    state.lastPosition = null;
    positionHandler()(BASE_POSITION);
    const [opts] = L.divIcon.mock.calls[L.divIcon.mock.calls.length - 1];
    expect(opts.iconSize).toEqual([40, 40]);
  });

  it('embeds the bearing rotation in the HTML', () => {
    state.lastPosition = { lat: 50, lng: -1 };
    positionHandler()({ ...BASE_POSITION, latitude: 51, longitude: 0 });
    const [opts] = L.divIcon.mock.calls[L.divIcon.mock.calls.length - 1];
    expect(opts.html).toMatch(/rotate\(\d+(\.\d+)?deg\)/);
  });

  it('defaults to rotate(0deg) when there is no previous position', () => {
    state.lastPosition = null;
    positionHandler()(BASE_POSITION);
    const [opts] = L.divIcon.mock.calls[L.divIcon.mock.calls.length - 1];
    expect(opts.html).toContain('rotate(0deg)');
  });

  it('passes the icon to marker.setIcon', () => {
    state.lastPosition = null;
    positionHandler()(BASE_POSITION);
    expect(mockMarkerInstance.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({ iconSize: [40, 40] })
    );
  });
});

// =============================================================================
// updateClock
// =============================================================================

describe('updateClock', () => {
  it('writes UTC HH:MM:SS to #utc-time immediately on load', () => {
    expect(document.getElementById('utc-time').textContent)
      .toMatch(/^UTC \d{2}:\d{2}:\d{2}$/);
  });

  it('updates the clock every second', () => {
    jest.advanceTimersByTime(1000);
    expect(document.getElementById('utc-time').textContent)
      .toMatch(/^UTC \d{2}:\d{2}:\d{2}$/);
  });
});

// =============================================================================
// Socket.IO — connect / disconnect
// =============================================================================

describe('Socket.IO — connect / disconnect', () => {
  it('marks connection as LIVE on connect', () => {
    getSocketHandler('connect')();
    expect(document.getElementById('connection-status').className).toContain('connected');
    expect(document.querySelector('.conn-label').textContent).toBe('LIVE');
  });

  it('marks connection as OFFLINE on disconnect', () => {
    getSocketHandler('disconnect')();
    expect(document.getElementById('connection-status').className).toContain('disconnected');
    expect(document.querySelector('.conn-label').textContent).toBe('OFFLINE');
  });
});

// =============================================================================
// Socket.IO — iss:position
// =============================================================================

describe('Socket.IO — iss:position', () => {
  let fire;

  beforeEach(() => {
    fire = getSocketHandler('iss:position');
    // Reset relevant state
    state.updateCount           = 0;
    state.distanceTraveled      = 0;
    state.lastPosition          = null;
    state.isInitialCenteringDone = true;
    state.altUnit               = 'km';
    state.velUnit               = 'kmh';
    mockMarkerInstance.setLatLng.mockClear();
    mockCircleInstance.setLatLng.mockClear();
    mockCircleInstance.setRadius.mockClear();
    mockMapInstance.panTo.mockClear();
    mockMapInstance.fitBounds.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({})
    });
  });

  // --- overlay ---

  it('hides the loading overlay on the first event', () => {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    state.isInitialCenteringDone = false;

    fire(BASE_POSITION);

    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  // --- initial centering ---

  it('auto-centers the map on the very first position', () => {
    state.isInitialCenteringDone = false;
    fire(BASE_POSITION);
    expect(mockMapInstance.panTo).toHaveBeenCalled();
    expect(mockMapInstance.fitBounds).toHaveBeenCalled();
    expect(state.isInitialCenteringDone).toBe(true);
  });

  it('does NOT auto-center on subsequent positions', () => {
    state.isInitialCenteringDone = true;
    fire(BASE_POSITION);
    expect(mockMapInstance.fitBounds).not.toHaveBeenCalled();
  });

  // --- state mutations ---

  it('increments state.updateCount on every event', () => {
    fire(BASE_POSITION);
    fire(BASE_POSITION);
    expect(state.updateCount).toBe(2);
  });

  it('stores the latest lat/lng in state.lastPosition', () => {
    fire(BASE_POSITION);
    expect(state.lastPosition).toEqual({
      lat: BASE_POSITION.latitude,
      lng: BASE_POSITION.longitude
    });
  });

  it('accumulates distanceTraveled after the second fix', () => {
    fire(BASE_POSITION);                                   // first — no prev pos
    expect(state.distanceTraveled).toBe(0);

    fire({ ...BASE_POSITION, latitude: 52, longitude: 0 }); // second — adds distance
    expect(state.distanceTraveled).toBeGreaterThan(0);
  });

  // --- telemetry DOM ---

  it('displays latitude with N indicator', () => {
    fire({ ...BASE_POSITION, latitude: 45 });
    expect(document.getElementById('telem-lat').textContent).toContain('N');
  });

  it('displays latitude with S indicator for negative values', () => {
    fire({ ...BASE_POSITION, latitude: -33 });
    expect(document.getElementById('telem-lat').textContent).toContain('S');
  });

  it('displays longitude with E indicator', () => {
    fire({ ...BASE_POSITION, longitude: 10 });
    expect(document.getElementById('telem-lon').textContent).toContain('E');
  });

  it('displays longitude with W indicator for negative values', () => {
    fire({ ...BASE_POSITION, longitude: -10 });
    expect(document.getElementById('telem-lon').textContent).toContain('W');
  });

  it('shows altitude in km when altUnit is "km"', () => {
    state.altUnit = 'km';
    fire(BASE_POSITION);
    expect(document.getElementById('telem-alt').textContent).toContain('km');
  });

  it('shows altitude in miles when altUnit is "mi"', () => {
    state.altUnit = 'mi';
    fire(BASE_POSITION);
    expect(document.getElementById('telem-alt').textContent).toContain('mi');
  });

  it('shows velocity in km/h when velUnit is "kmh"', () => {
    state.velUnit = 'kmh';
    fire(BASE_POSITION);
    expect(document.getElementById('telem-vel').textContent).toContain('km/h');
  });

  it('shows velocity in mph when velUnit is "mph"', () => {
    state.velUnit = 'mph';
    fire(BASE_POSITION);
    expect(document.getElementById('telem-vel').textContent).toContain('mph');
  });

  it('displays "Daylight" when visibility is daylight', () => {
    fire({ ...BASE_POSITION, visibility: 'daylight' });
    expect(document.getElementById('telem-vis').textContent).toContain('Daylight');
  });

  it('displays "Eclipsed" when visibility is eclipsed', () => {
    fire({ ...BASE_POSITION, visibility: 'eclipsed' });
    expect(document.getElementById('telem-vis').textContent).toContain('Eclipsed');
  });

  // --- location cache / fetch ---

  it('fetches /api/iss/location-info for an unseen grid cell', () => {
    // Use an extreme coordinate unlikely to be cached by earlier tests
    fire({ ...BASE_POSITION, latitude: -89, longitude: -179 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/iss/location-info')
    );
  });

  it('uses the cached value without fetching for a repeated grid cell', async () => {
    const uniqueLat = 77, uniqueLon = 77;
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ country: 'Arctic', city: 'Nowhere' })
    });

    fire({ ...BASE_POSITION, latitude: uniqueLat, longitude: uniqueLon });
    await flushPromises();

    global.fetch.mockClear();
    fire({ ...BASE_POSITION, latitude: uniqueLat, longitude: uniqueLon }); // same cell
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows "--" when the location fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    fire({ ...BASE_POSITION, latitude: -70, longitude: -70 });
    await flushPromises();
    expect(document.getElementById('telem-location').textContent).toBe('--');
  });

  // --- map updates ---

  it('moves the ISS marker to the new position', () => {
    fire(BASE_POSITION);
    expect(mockMarkerInstance.setLatLng).toHaveBeenCalled();
  });

  it('moves the footprint circle to the new position', () => {
    fire(BASE_POSITION);
    expect(mockCircleInstance.setLatLng).toHaveBeenCalled();
  });

  it('updates the footprint radius when footprint_radius_km is provided', () => {
    fire({ ...BASE_POSITION, footprint_radius_km: 3000 });
    expect(mockCircleInstance.setRadius).toHaveBeenCalledWith(3000 * 1000);
  });

  it('does NOT update footprint radius when footprint_radius_km is absent', () => {
    const { footprint_radius_km: _, ...noRadius } = BASE_POSITION;
    fire(noRadius);
    expect(mockCircleInstance.setRadius).not.toHaveBeenCalled();
  });

  it('pans the map when state.following is true', () => {
    state.following = true;
    fire(BASE_POSITION);
    expect(mockMapInstance.panTo).toHaveBeenCalled();
    state.following = false;
  });

  it('does NOT pan the map when state.following is false', () => {
    state.following = false;
    fire(BASE_POSITION);
    expect(mockMapInstance.panTo).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Socket.IO — iss:orbital-path
// =============================================================================

describe('Socket.IO — iss:orbital-path', () => {
  let fire;

  beforeEach(() => {
    fire = getSocketHandler('iss:orbital-path');
    L.polyline.mockClear();
    mockMapInstance.removeLayer.mockClear();
  });

  it('draws a polyline for each past segment', () => {
    fire({ past: [[[10, 20], [11, 21]], [[12, 22], [13, 23]]], future: [] });
    expect(L.polyline).toHaveBeenCalledTimes(2);
  });

  it('draws a polyline for each future segment', () => {
    fire({ past: [], future: [[[10, 20], [11, 21], [12, 22]]] });
    expect(L.polyline).toHaveBeenCalledTimes(1);
  });

  it('colours past segments cyan (#00d4ff)', () => {
    fire({ past: [[[10, 20], [11, 21]]], future: [] });
    expect(L.polyline).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ color: '#00d4ff' })
    );
  });

  it('colours future segments orange (#ff8c00) with a dashArray', () => {
    fire({ past: [], future: [[[10, 20], [11, 21]]] });
    expect(L.polyline).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ color: '#ff8c00', dashArray: expect.any(String) })
    );
  });

  it('skips segments with fewer than 2 points', () => {
    fire({ past: [[[10, 20]]], future: [[[11, 21]]] });
    expect(L.polyline).not.toHaveBeenCalled();
  });

  it('removes old layers before drawing new ones', () => {
    // Draw something first so pathLayers is populated
    fire({ past: [[[10, 20], [11, 21]]], future: [] });
    mockMapInstance.removeLayer.mockClear();
    // Draw again — previous layer should be removed
    fire({ past: [[[12, 22], [13, 23]]], future: [] });
    expect(mockMapInstance.removeLayer).toHaveBeenCalled();
  });

  it('handles a payload with no past or future keys without throwing', () => {
    expect(() => fire({})).not.toThrow();
  });
});

// =============================================================================
// Socket.IO — iss:astronauts / updateCrew
// =============================================================================

describe('Socket.IO — iss:astronauts (updateCrew)', () => {
  let fire;

  beforeEach(() => {
    fire = getSocketHandler('iss:astronauts');
  });

  it('updates the crew count element', () => {
    fire({ crew: [{ name: 'A', agency: 'NASA', iss: true }, { name: 'B', agency: 'NASA', iss: true }] });
    expect(document.getElementById('crew-count').textContent).toBe('2');
  });

  it('shows a placeholder when the crew array is empty', () => {
    fire({ crew: [] });
    expect(document.getElementById('crew-list').innerHTML).toContain('No crew data available');
  });

  it('shows a placeholder when the crew key is absent', () => {
    fire({});
    expect(document.getElementById('crew-list').innerHTML).toContain('No crew data available');
  });

  it('renders a crew card with the member name', () => {
    fire({ crew: [{ name: 'Anne Astronaut', agency: 'NASA', iss: true }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('Anne Astronaut');
  });

  it('uses "Astronaut" as the default role when position is absent', () => {
    fire({ crew: [{ name: 'Jane Doe', agency: 'NASA', iss: true }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('Astronaut');
  });

  it('renders a flag image when flag_code is present', () => {
    fire({ crew: [{ name: 'A', agency: 'NASA', iss: true, flag_code: 'US', country: 'USA' }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('flagcdn.com');
  });

  it('computes days in space from a launched timestamp', () => {
    const nowSec     = Math.floor(Date.now() / 1000);
    const tenDaysAgo = nowSec - 10 * 86400;
    fire({ crew: [{ name: 'A', agency: 'NASA', iss: true, launched: tenDaysAgo }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('10 days');
  });

  it('shows 0 days when launched is absent', () => {
    fire({ crew: [{ name: 'A', agency: 'NASA', iss: true }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('0 days');
  });

  it('sorts NASA → Roscosmos → other agencies', () => {
    fire({
      crew: [
        { name: 'ESA Guy',  agency: 'ESA',       iss: true },
        { name: 'Cosmo',    agency: 'Roscosmos',  iss: true },
        { name: 'Nasa Lady',agency: 'NASA',       iss: true }
      ]
    });
    const html     = document.getElementById('crew-list').innerHTML;
    const idxNasa  = html.indexOf('NASA');
    const idxRosco = html.indexOf('Roscosmos');
    const idxEsa   = html.indexOf('ESA');
    expect(idxNasa).toBeLessThan(idxRosco);
    expect(idxRosco).toBeLessThan(idxEsa);
  });

  it('shows ISS tag for ISS crew members', () => {
    fire({ crew: [{ name: 'A', agency: 'NASA', iss: true }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('>ISS<');
  });

  it('shows TIANGONG tag for non-ISS crew members', () => {
    fire({ crew: [{ name: 'T', agency: 'CMSA', iss: false }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('TIANGONG');
  });

  it('uses a default agency icon for unknown agencies', () => {
    fire({ crew: [{ name: 'X', agency: 'UNKNOWN_AGENCY', iss: true }] });
    expect(document.getElementById('crew-list').innerHTML).toContain('UNKNOWN_AGENCY');
  });
});

// =============================================================================
// Socket.IO — iss:error
// =============================================================================

describe('Socket.IO — iss:error', () => {
  it('logs a warning to the console without throwing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => getSocketHandler('iss:error')({ source: 'test', message: 'oops' })).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[ISS Error]', 'test', 'oops');
    warn.mockRestore();
  });
});

// =============================================================================
// Control Buttons
// =============================================================================

describe('Control button — #center-btn', () => {
  beforeEach(() => mockMapInstance.flyTo.mockClear());

  it('flies to the last known position at zoom 4', () => {
    state.lastPosition = { lat: 40, lng: -74 };
    click('center-btn');
    expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
      [40, -74], 4, expect.objectContaining({ animate: true })
    );
  });

  it('is a no-op when no position has been received yet', () => {
    state.lastPosition = null;
    click('center-btn');
    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------

describe('Control button — #follow-btn', () => {
  beforeEach(() => {
    state.following = false;
    const btn = document.getElementById('follow-btn');
    btn.classList.remove('active');
    btn.textContent = '▶ Follow ISS';
  });

  it('toggles state.following on each click', () => {
    click('follow-btn');
    expect(state.following).toBe(true);
    click('follow-btn');
    expect(state.following).toBe(false);
  });

  it('updates button text to "⏸ Following" when active', () => {
    click('follow-btn');
    expect(document.getElementById('follow-btn').textContent).toBe('⏸ Following');
  });

  it('updates button text to "▶ Follow ISS" when inactive', () => {
    click('follow-btn'); // activate
    click('follow-btn'); // deactivate
    expect(document.getElementById('follow-btn').textContent).toBe('▶ Follow ISS');
  });

  it('adds the "active" CSS class when following is enabled', () => {
    click('follow-btn');
    expect(document.getElementById('follow-btn').classList.contains('active')).toBe(true);
  });

  it('removes the "active" CSS class when following is disabled', () => {
    click('follow-btn');
    click('follow-btn');
    expect(document.getElementById('follow-btn').classList.contains('active')).toBe(false);
  });
});

// -----------------------------------------------------------------------------

describe('Control button — #alt-toggle', () => {
  it('cycles altUnit from "km" to "mi"', () => {
    state.altUnit = 'km';
    click('alt-toggle');
    expect(state.altUnit).toBe('mi');
  });

  it('cycles altUnit from "mi" back to "km"', () => {
    state.altUnit = 'mi';
    click('alt-toggle');
    expect(state.altUnit).toBe('km');
  });
});

// -----------------------------------------------------------------------------

describe('Control button — #vel-toggle', () => {
  it('cycles velUnit from "kmh" to "mph"', () => {
    state.velUnit = 'kmh';
    click('vel-toggle');
    expect(state.velUnit).toBe('mph');
  });

  it('cycles velUnit from "mph" back to "kmh"', () => {
    state.velUnit = 'mph';
    click('vel-toggle');
    expect(state.velUnit).toBe('kmh');
  });
});

// -----------------------------------------------------------------------------

describe('Control button — #sidebar-toggle', () => {
  it('toggles the "open" class on the sidebar', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
    click('sidebar-toggle');
    expect(sidebar.classList.contains('open')).toBe(true);
    click('sidebar-toggle');
    expect(sidebar.classList.contains('open')).toBe(false);
  });
});

// -----------------------------------------------------------------------------

describe('Control button — #terminator-btn', () => {
  beforeEach(() => {
    state.terminatorActive  = false;
    state.terminatorLayer   = null;
    state.dayLayer          = null;
    L.rectangle.mockClear();
    L.terminator.mockClear();
    mockRectInstance.addTo.mockClear();
    mockTerminatorInstance.addTo.mockClear();
    mockMapInstance.removeLayer.mockClear();
  });

  it('sets terminatorActive to true on first click', () => {
    click('terminator-btn');
    expect(state.terminatorActive).toBe(true);
  });

  it('creates a full-world white rectangle (dayLayer)', () => {
    click('terminator-btn');
    expect(L.rectangle).toHaveBeenCalledWith(
      [[-90, -180], [90, 180]],
      expect.objectContaining({ fillColor: '#ffffff' })
    );
  });

  it('creates the L.terminator night polygon', () => {
    click('terminator-btn');
    expect(L.terminator).toHaveBeenCalledWith(
      expect.objectContaining({ fillColor: '#000820' })
    );
  });

  it('stores both layers in state', () => {
    click('terminator-btn');
    expect(state.dayLayer).not.toBeNull();
    expect(state.terminatorLayer).not.toBeNull();
  });

  it('removes both layers and nulls state when deactivated', () => {
    click('terminator-btn'); // activate
    mockMapInstance.removeLayer.mockClear();
    click('terminator-btn'); // deactivate

    expect(state.terminatorActive).toBe(false);
    expect(mockMapInstance.removeLayer).toHaveBeenCalledTimes(2);
    expect(state.dayLayer).toBeNull();
    expect(state.terminatorLayer).toBeNull();
  });

  it('calls setTime on the terminator layer every 60 seconds', () => {
    click('terminator-btn'); // activate
    mockTerminatorInstance.setTime.mockClear();

    jest.advanceTimersByTime(60000);

    expect(mockTerminatorInstance.setTime).toHaveBeenCalled();

    click('terminator-btn'); // deactivate (clears interval)
  });

  it('does not throw when L.terminator is not loaded', () => {
    const saved = L.terminator;
    delete L.terminator;

    expect(() => click('terminator-btn')).not.toThrow();

    L.terminator         = saved;
    state.terminatorActive = false; // manual reset since layers were never created
  });
});

// -----------------------------------------------------------------------------

describe('Control button — #mylocation-btn', () => {
  beforeEach(() => {
    const btn = document.getElementById('mylocation-btn');
    btn.textContent = '📍 Use My Location';
    btn.disabled    = false;
    document.getElementById('pass-info').innerHTML = '';
    mockGetCurrentPosition.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        passes: [{
          riseTime:     new Date('2026-04-10T14:00:00Z').getTime(),
          maxElevation: 75,
          duration:     360
        }]
      })
    });
  });

  it('shows an error when geolocation is unavailable', () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined, configurable: true
    });

    click('mylocation-btn');
    expect(document.getElementById('pass-info').innerHTML).toContain('not supported');

    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition }, configurable: true
    });
  });

  it('disables the button while locating', () => {
    mockGetCurrentPosition.mockImplementation(() => { /* never resolves */ });
    click('mylocation-btn');
    expect(document.getElementById('mylocation-btn').disabled).toBe(true);
  });

  it('calls /api/iss/passes with the user coordinates on success', async () => {
    mockGetCurrentPosition.mockImplementation((ok) => {
      ok({ coords: { latitude: 51.5, longitude: -0.1 } });
    });

    click('mylocation-btn');
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/iss/passes?lat=51.5&lon=-0.1')
    );
  });

  it('re-enables the button after a successful fetch', async () => {
    mockGetCurrentPosition.mockImplementation((ok) => {
      ok({ coords: { latitude: 51.5, longitude: -0.1 } });
    });

    click('mylocation-btn');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('mylocation-btn').disabled).toBe(false);
  });

  it('shows "No visible passes found" when the passes array is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ passes: [] })
    });
    mockGetCurrentPosition.mockImplementation((ok) => {
      ok({ coords: { latitude: 51.5, longitude: -0.1 } });
    });

    click('mylocation-btn');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('pass-info').innerHTML).toContain('No visible passes');
  });

  it('shows an error when the fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    mockGetCurrentPosition.mockImplementation((ok) => {
      ok({ coords: { latitude: 51.5, longitude: -0.1 } });
    });

    click('mylocation-btn');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('pass-info').innerHTML).toContain('Failed to fetch');
  });

  it('shows a location-denied error when the user rejects geolocation', () => {
    mockGetCurrentPosition.mockImplementation((_, err) => {
      err({ message: 'User denied Geolocation' });
    });

    click('mylocation-btn');
    expect(document.getElementById('pass-info').innerHTML).toContain('Location denied');
  });

  it('re-enables the button after geolocation is denied', () => {
    mockGetCurrentPosition.mockImplementation((_, err) => {
      err({ message: 'denied' });
    });

    click('mylocation-btn');
    expect(document.getElementById('mylocation-btn').disabled).toBe(false);
  });
});

// =============================================================================
// Map Interaction Handlers
// =============================================================================

describe('Map click — close sidebar on mobile', () => {
  it('removes the "open" class when viewport width ≤ 768 px', () => {
    document.getElementById('sidebar').classList.add('open');
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });

    getMapHandler('click')();

    expect(document.getElementById('sidebar').classList.contains('open')).toBe(false);
  });

  it('leaves the sidebar open on wider viewports', () => {
    document.getElementById('sidebar').classList.add('open');
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

    getMapHandler('click')();

    expect(document.getElementById('sidebar').classList.contains('open')).toBe(true);
  });
});

// -----------------------------------------------------------------------------

describe('Map dragstart/zoomstart — cancel follow mode', () => {
  beforeEach(() => {
    state.following = true;
    const btn = document.getElementById('follow-btn');
    btn.classList.add('active');
    btn.textContent = '⏸ Following';
  });

  it('disables follow mode when the user drags the map', () => {
    getMapHandler('dragstart zoomstart')();
    expect(state.following).toBe(false);
  });

  it('removes the "active" class from the follow button', () => {
    getMapHandler('dragstart zoomstart')();
    expect(document.getElementById('follow-btn').classList.contains('active')).toBe(false);
  });

  it('resets the follow button text', () => {
    getMapHandler('dragstart zoomstart')();
    expect(document.getElementById('follow-btn').textContent).toBe('▶ Follow ISS');
  });

  it('is a no-op when following is already false', () => {
    state.following = false;
    expect(() => getMapHandler('dragstart zoomstart')()).not.toThrow();
    expect(state.following).toBe(false);
  });
});
