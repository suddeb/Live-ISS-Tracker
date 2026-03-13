/**
 * ISS Live Tracker - Backend Server
 * Express + Socket.IO real-time ISS position broadcaster
 */

require('dotenv').config();

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const axios        = require('axios');
const cron         = require('node-cron');
const rateLimit    = require('express-rate-limit');
const satellite    = require('satellite.js');
const path         = require('path');

// ─── App Setup ───────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter: max 30 requests per minute per IP on API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// ─── In-Memory State ─────────────────────────────────────────────────────────

let currentPosition  = null;   // Latest ISS position data
let currentTLE       = null;   // Latest TLE lines { line1, line2 }
let currentAstronauts = [];    // Current ISS crew
let orbitalPath      = null;   // { past: [...], future: [...] }

// ─── Utility: Exponential Backoff Fetch ──────────────────────────────────────

/**
 * Fetch a URL with automatic retries and exponential backoff.
 * @param {string} url
 * @param {object} options  - axios config
 * @param {number} retries  - max attempts
 * @param {number} delay    - initial delay in ms
 */
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 8000, ...options });
      return response.data;
    } catch (err) {
      const isLast = attempt === retries;
      console.error(
        `[${new Date().toISOString()}] Fetch attempt ${attempt}/${retries} failed for ${url}: ${err.message}`
      );
      if (isLast) throw err;
      await new Promise(r => setTimeout(r, delay * 2 ** (attempt - 1)));
    }
  }
}

// ─── Orbital Path Computation ─────────────────────────────────────────────────

/**
 * Compute ISS orbital path ±45 minutes from now using satellite.js.
 * Handles antimeridian crossing by splitting segments.
 */
function computeOrbitalPath(tle) {
  if (!tle || !tle.line1 || !tle.line2) return null;

  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    const now    = new Date();
    const points = [];

    // Compute positions from -45 to +45 minutes, 1-minute steps
    for (let minuteOffset = -45; minuteOffset <= 45; minuteOffset++) {
      const date   = new Date(now.getTime() + minuteOffset * 60 * 1000);
      const posVel = satellite.propagate(satrec, date);
      if (!posVel.position) continue;

      const gmst     = satellite.gstime(date);
      const geodetic = satellite.eciToGeodetic(posVel.position, gmst);
      points.push({
        lat: satellite.degreesLat(geodetic.latitude),
        lng: satellite.degreesLong(geodetic.longitude),
        minuteOffset
      });
    }

    // Split at the antimeridian (longitude jump > 180°)
    function splitAtAntimeridian(pts) {
      const segments = [];
      let current    = [];
      for (let i = 0; i < pts.length; i++) {
        if (i > 0) {
          const diff = Math.abs(pts[i].lng - pts[i - 1].lng);
          if (diff > 180) {
            if (current.length) segments.push(current);
            current = [];
          }
        }
        current.push([pts[i].lat, pts[i].lng]);
      }
      if (current.length) segments.push(current);
      return segments;
    }

    const pastPoints   = points.filter(p => p.minuteOffset <= 0);
    const futurePoints = points.filter(p => p.minuteOffset >= 0);

    return {
      past:   splitAtAntimeridian(pastPoints),
      future: splitAtAntimeridian(futurePoints)
    };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Orbital path error:`, err.message);
    return null;
  }
}

// ─── ISS Position Fetcher ─────────────────────────────────────────────────────

/**
 * Fetch the latest ISS position and normalise it for emission.
 */
async function fetchISSPosition() {
  const data = await fetchWithRetry(
    'https://api.wheretheiss.at/v1/satellites/25544'
  );

  const footprintRadius = (data.footprint / (2 * Math.PI)) * 1000; // convert km arc to metres

  return {
    latitude:           data.latitude,
    longitude:          data.longitude,
    altitude_km:        Math.round(data.altitude * 10) / 10,
    altitude_miles:     Math.round(data.altitude * 0.621371 * 10) / 10,
    velocity_kmh:       Math.round(data.velocity * 10) / 10,
    velocity_mph:       Math.round(data.velocity * 0.621371 * 10) / 10,
    visibility:         data.visibility,          // 'daylight' | 'eclipsed'
    timestamp:          data.timestamp,
    footprint_radius_km: Math.round(data.footprint / (2 * Math.PI) * 10) / 10
  };
}

// ─── REST API Routes ──────────────────────────────────────────────────────────

// GET /api/iss/position – current ISS location
app.get('/api/iss/position', async (req, res) => {
  try {
    const position = currentPosition || await fetchISSPosition();
    res.json(position);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] /api/iss/position error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch ISS position' });
  }
});

// GET /api/iss/astronauts – current ISS crew
app.get('/api/iss/astronauts', async (req, res) => {
  try {
    const data = await fetchWithRetry('http://api.open-notify.org/astros.json');
    const crew = (data.people || []).filter(p => p.craft === 'ISS');
    res.json({ crew, count: crew.length });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] /api/iss/astronauts error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch astronaut data' });
  }
});

// GET /api/iss/tle – Two-Line Element set
app.get('/api/iss/tle', async (req, res) => {
  try {
    const data = await fetchWithRetry(
      'https://api.wheretheiss.at/v1/satellites/25544/tles'
    );
    res.json({ line1: data.line1, line2: data.line2, name: data.name });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] /api/iss/tle error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch TLE data' });
  }
});

// GET /api/iss/location-info?lat=X&lon=Y – reverse geocode
app.get('/api/iss/location-info', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

  try {
    const data = await fetchWithRetry(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'ISS-Tracker-App/1.0' } }
    );
    const addr = data.address || {};
    res.json({
      country:     addr.country          || null,
      city:        addr.city || addr.town || addr.village || null,
      ocean:       addr.body_of_water || addr.sea || addr.ocean || null,
      displayName: data.display_name    || 'Unknown Location'
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] /api/iss/location-info error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch location info' });
  }
});

// GET /api/iss/passes?lat=X&lon=Y – predict next visible passes (bonus)
app.get('/api/iss/passes', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  if (!currentTLE)  return res.status(503).json({ error: 'TLE data not yet loaded' });

  try {
    const observer = {
      longitude: satellite.degreesToRadians(parseFloat(lon)),
      latitude:  satellite.degreesToRadians(parseFloat(lat)),
      height:    0.1   // km above sea level
    };

    const satrec  = satellite.twoline2satrec(currentTLE.line1, currentTLE.line2);
    const passes  = [];
    const now     = Date.now();
    const step    = 30 * 1000;       // 30-second resolution
    const window  = 7 * 24 * 3600 * 1000; // search 7 days ahead

    let aboveHorizon = false;
    let riseTime     = null;
    let maxEl        = 0;

    for (let t = now; t < now + window && passes.length < 5; t += step) {
      const date   = new Date(t);
      const posVel = satellite.propagate(satrec, date);
      if (!posVel.position) continue;

      const gmst     = satellite.gstime(date);
      const lookAngles = satellite.ecfToLookAngles(
        observer,
        satellite.eciToEcf(posVel.position, gmst)
      );
      const elevDeg = satellite.radiansToDegrees(lookAngles.elevation);

      if (elevDeg > 0 && !aboveHorizon) {
        aboveHorizon = true;
        riseTime     = date;
        maxEl        = elevDeg;
      } else if (elevDeg > 0 && aboveHorizon) {
        maxEl = Math.max(maxEl, elevDeg);
      } else if (elevDeg <= 0 && aboveHorizon) {
        aboveHorizon = false;
        passes.push({
          riseTime:    riseTime.toISOString(),
          setTime:     date.toISOString(),
          maxElevation: Math.round(maxEl * 10) / 10,
          duration:    Math.round((date - riseTime) / 1000) // seconds
        });
        maxEl = 0;
      }
    }

    res.json({ passes, location: { lat: parseFloat(lat), lon: parseFloat(lon) } });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] /api/iss/passes error:`, err.message);
    res.status(500).json({ error: 'Failed to compute pass predictions' });
  }
});

// ─── Socket.IO Events ─────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  // Send the current state immediately on connect
  if (currentPosition)   socket.emit('iss:position', currentPosition);
  if (currentAstronauts.length) socket.emit('iss:astronauts', { crew: currentAstronauts, count: currentAstronauts.length });
  if (orbitalPath)       socket.emit('iss:orbital-path', orbitalPath);

  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}`);
  });
});

// ─── Scheduled Background Jobs ────────────────────────────────────────────────

// Every 2 seconds – broadcast ISS position
let positionInterval = setInterval(async () => {
  try {
    currentPosition = await fetchISSPosition();
    io.emit('iss:position', currentPosition);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Position broadcast error:`, err.message);
    io.emit('iss:error', { source: 'position', message: 'Temporarily unable to fetch ISS position' });
  }
}, 2000);

// Every 60 seconds – broadcast crew list
async function broadcastAstronauts() {
  try {
    const data = await fetchWithRetry('http://api.open-notify.org/astros.json');
    currentAstronauts = (data.people || []).filter(p => p.craft === 'ISS');
    io.emit('iss:astronauts', { crew: currentAstronauts, count: currentAstronauts.length });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Astronaut broadcast error:`, err.message);
  }
}
broadcastAstronauts(); // initial load
cron.schedule('*/60 * * * * *', broadcastAstronauts);

// Every 30 minutes – refresh TLE and recompute orbital path
async function broadcastTLE() {
  try {
    const data = await fetchWithRetry(
      'https://api.wheretheiss.at/v1/satellites/25544/tles'
    );
    currentTLE  = { line1: data.line1, line2: data.line2 };
    orbitalPath = computeOrbitalPath(currentTLE);

    io.emit('iss:tle', currentTLE);
    if (orbitalPath) io.emit('iss:orbital-path', orbitalPath);

    console.log(`[${new Date().toISOString()}] TLE refreshed and orbital path recomputed`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] TLE broadcast error:`, err.message);
  }
}
broadcastTLE(); // initial load
cron.schedule('*/30 * * * *', broadcastTLE); // every 30 minutes

// ─── Start Server ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n🛰️  ISS Tracker running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
