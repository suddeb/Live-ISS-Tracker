# 🛰️ ISS Live Tracker

A real-time International Space Station tracker built with **Node.js**, **Express**,
**Socket.IO**, and **Leaflet.js**. Styled after [isstracker.pl](https://isstracker.pl) with
a dark space aesthetic and glassmorphism UI panels.

---

## Features

| Feature | Details |
|---|---|
| **Real-time position** | ISS location pushed every 2 s via Socket.IO |
| **Dark map** | CartoDB Dark Matter tile layer |
| **Custom ISS marker** | SVG satellite icon with pulsing ring + bearing rotation |
| **Visibility footprint** | Semi-transparent cyan circle (~2,200 km radius) |
| **Orbital path** | Past 45 min (cyan solid) + future 45 min (orange dashed) |
| **Live telemetry** | Lat, Lon, Altitude, Velocity, Visibility, Location |
| **Crew list** | Current ISS astronauts fetched from open-notify |
| **Next Pass Predictor** | Browser geolocation → next 3 visible passes (bonus) |
| **Day/Night terminator** | Optional layer via Leaflet.terminator (bonus) |
| **Rate limiting** | 30 req/min per IP on `/api/*` routes |
| **Responsive design** | Sidebar becomes a bottom drawer on mobile |

---

## Installation

```bash
# 1. Clone / enter the project directory
cd iss-tracker

# 2. Install dependencies
npm install

# 3. (Optional) copy and edit the environment file
cp .env.example .env
```

## Run the app

```bash
# Production
node server.js

# Development with auto-restart
npx nodemon server.js
```

## Open in browser

```
http://localhost:3000
```

---

## Project Structure

```
iss-tracker/
├── package.json          # Dependencies and scripts
├── server.js             # Express + Socket.IO backend
├── .env.example          # Environment variable template
├── README.md
└── public/
    ├── index.html        # Main page (Leaflet, Socket.IO client)
    ├── css/
    │   └── style.css     # Dark space theme
    └── js/
        └── app.js        # Leaflet map + Socket.IO event handlers
```

---

## API Reference

All endpoints return JSON. They are proxied through the local server to avoid
browser CORS restrictions.

| Method | Route | Description |
|---|---|---|
| GET | `/api/iss/position` | Current ISS lat/lon/altitude/velocity |
| GET | `/api/iss/astronauts` | ISS crew list |
| GET | `/api/iss/tle` | Two-Line Element set |
| GET | `/api/iss/location-info?lat=X&lon=Y` | Reverse geocode |
| GET | `/api/iss/passes?lat=X&lon=Y` | Next 5 visible passes (7-day window) |

---

## External APIs Used

| API | Usage |
|---|---|
| [wheretheiss.at](https://wheretheiss.at/w/developer) | ISS position, TLE |
| [open-notify.org](http://open-notify.org/Open-Notify-API/People-In-Space/) | Crew aboard ISS |
| [Nominatim / OSM](https://nominatim.openstreetmap.org) | Reverse geocoding |

---

## Socket.IO Events

| Event | Direction | Payload |
|---|---|---|
| `iss:position` | server → client | `{ latitude, longitude, altitude_km, altitude_miles, velocity_kmh, velocity_mph, visibility, timestamp, footprint_radius_km }` |
| `iss:orbital-path` | server → client | `{ past: [[lat,lng][]...], future: [[lat,lng][]...] }` |
| `iss:astronauts` | server → client | `{ crew: [{name, craft}], count }` |
| `iss:tle` | server → client | `{ line1, line2 }` |
| `iss:error` | server → client | `{ source, message }` |

---

## License

MIT
# ISS-Live-Tracker
# Live-ISS-Tracker
