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

describe('ISS Crew Rendering', () => {
  let app;
  let socketMock;

  beforeEach(() => {
    jest.useFakeTimers();
    // Set a fixed time: 2024-08-01T12:00:00Z (1722513600 seconds)
    jest.setSystemTime(new Date('2024-08-01T12:00:00Z'));
    jest.clearAllMocks();
    
    jest.isolateModules(() => {
      app = require('../app.js');
    });
    
    socketMock = io.mock.results[0].value;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should render enriched crew member cards correctly for all stations', () => {
    const handlers = getSocketHandlers(socketMock);
    const mockCrew = {
      count: 2,
      crew: [
        {
          name: 'Oleg Kononenko',
          agency: 'Roscosmos',
          position: 'Commander',
          country: 'Russia',
          flag_code: 'ru',
          spacecraft: 'Soyuz MS-25',
          launched: 1711193461, // 2024-03-23
          url: 'https://en.wikipedia.org/wiki/Oleg_Kononenko',
          image: 'https://img.com/oleg.jpg',
          iss: true
        },
        {
          name: 'Ye Guangfu',
          agency: 'CMSA',
          position: 'Commander',
          country: 'China',
          flag_code: 'cn',
          spacecraft: 'Shenzhou 18',
          launched: 1714041600, // 2024-04-25
          url: 'https://en.wikipedia.org/wiki/Ye_Guangfu',
          image: 'https://img.com/ye.jpg',
          iss: false
        }
      ]
    };

    handlers['iss:astronauts'](mockCrew);

    const crewList = document.getElementById('crew-list');
    const crewCount = document.getElementById('crew-count');

    expect(crewCount.textContent).toBe('2');
    
    // Check ISS member
    expect(crewList.innerHTML).toContain('Oleg Kononenko');
    expect(crewList.innerHTML).toContain('ISS');
    expect(crewList.innerHTML).toContain('Soyuz MS-25');
    expect(crewList.innerHTML).toContain('131 days'); // approx 131 days from March 23 to Aug 1
    expect(crewList.innerHTML).toContain('flagcdn.com/ru.svg');

    // Check Tiangong member
    expect(crewList.innerHTML).toContain('Ye Guangfu');
    expect(crewList.innerHTML).toContain('TIANGONG');
    expect(crewList.innerHTML).toContain('Shenzhou 18');
    expect(crewList.innerHTML).toContain('98 days'); // approx 98 days from April 25 to Aug 1
    expect(crewList.innerHTML).toContain('flagcdn.com/cn.svg');
  });

  test('should handle empty crew list', () => {
    const handlers = getSocketHandlers(socketMock);
    handlers['iss:astronauts']({ crew: [], count: 0 });

    const crewList = document.getElementById('crew-list');
    expect(crewList.innerHTML).toContain('No crew data available');
  });
});
