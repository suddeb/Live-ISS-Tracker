/**
 * @jest-environment jsdom
 */

// Mock Leaflet
const L = {
  map: jest.fn().mockReturnValue({
    setView: jest.fn().mockReturnThis(),
    panTo: jest.fn().mockReturnThis(),
    flyTo: jest.fn().mockReturnThis(),
    removeLayer: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    fitBounds: jest.fn().mockReturnThis(),
  }),
  tileLayer: jest.fn().mockReturnValue({
    addTo: jest.fn().mockReturnThis(),
  }),
  divIcon: jest.fn(),
  marker: jest.fn().mockReturnValue({
    addTo: jest.fn().mockReturnThis(),
    setLatLng: jest.fn().mockReturnThis(),
    setIcon: jest.fn().mockReturnThis(),
  }),
  circle: jest.fn().mockReturnValue({
    addTo: jest.fn().mockReturnThis(),
    setLatLng: jest.fn().mockReturnThis(),
    setRadius: jest.fn().mockReturnThis(),
    getBounds: jest.fn().mockReturnValue({}),
  }),
  latLng: jest.fn((lat, lon) => ({ lat, lon })),
  polyline: jest.fn().mockReturnValue({
    addTo: jest.fn().mockReturnThis(),
  }),
  rectangle: jest.fn().mockReturnValue({
    addTo: jest.fn().mockReturnThis(),
  }),
};

global.L = L;

// Mock Socket.IO
const io = jest.fn().mockReturnValue({
  on: jest.fn(),
  id: 'test-socket-id',
});
global.io = io;

// Mock fetch
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => Promise.resolve({ country: 'Test Country', city: 'Test City' }),
  })
);

// Mock DOM elements needed by app.js
document.body.innerHTML = `
  <div id="map"></div>
  <div id="loading-overlay"></div>
  <div id="connection-status"><span class="conn-dot"></span><span class="conn-label"></span></div>
  <div id="utc-time"></div>
  <div id="telem-lat"></div>
  <div id="telem-lon"></div>
  <div id="telem-alt"></div>
  <div id="telem-vel"></div>
  <div id="telem-vis"></div>
  <div id="telem-location"></div>
  <div id="telem-distance"></div>
  <div id="telem-updates"></div>
  <div id="crew-list"></div>
  <div id="crew-count"></div>
  <button id="center-btn"></button>
  <button id="follow-btn"></button>
  <button id="terminator-btn"></button>
  <button id="mylocation-btn"></button>
  <div id="pass-info"></div>
  <div id="sidebar"></div>
  <button id="sidebar-toggle"></button>
  <button id="alt-toggle"></button>
  <button id="vel-toggle"></button>
`;

// Helper to get socket event handlers
function getSocketHandlers(socketMock) {
  const handlers = {};
  socketMock.on.mock.calls.forEach(([event, handler]) => {
    handlers[event] = handler;
  });
  return handlers;
}

describe('ISS Initial Centering', () => {
  let app;
  let socketMock;

  beforeEach(() => {
    jest.useFakeTimers();
    // Clear mocks
    jest.clearAllMocks();
    
    // Reset state and re-require app.js to trigger initialization
    jest.isolateModules(() => {
      app = require('../app.js');
    });
    
    socketMock = io.mock.results[0].value;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should center map on first iss:position update', () => {
    const handlers = getSocketHandlers(socketMock);
    const mockData = {
      latitude: 45.0,
      longitude: -90.0,
      altitude_km: 420,
      velocity_kmh: 28000,
      visibility: 'daylight',
      footprint_radius_km: 2200
    };

    // First update
    handlers['iss:position'](mockData);

    // Verify map.panTo was called for initial centering (implementation pending)
    const mapInstance = app.map;
    expect(mapInstance.panTo).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 45.0, lon: -90.0 }),
      expect.any(Object)
    );
  });

  test('should not center map on subsequent updates if not following', () => {
    const handlers = getSocketHandlers(socketMock);
    const mockData = { latitude: 45.0, longitude: -90.0 };

    // First update
    handlers['iss:position'](mockData);
    
    const mapInstance = app.map;
    // We expect 1 call from initial centering (once implemented)
    const callsAfterFirst = mapInstance.panTo.mock.calls.length;

    // Second update
    handlers['iss:position']({ latitude: 46.0, longitude: -91.0 });

    expect(mapInstance.panTo.mock.calls.length).toBe(callsAfterFirst);
  });
});
