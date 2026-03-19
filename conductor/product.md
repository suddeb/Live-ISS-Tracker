# Product Definition

## Vision
To provide a high-fidelity, real-time visualization of the International Space Station's (ISS) current position, orbital path, and crew information through an immersive, dark-themed web interface.

## Target Audience
- Space enthusiasts and hobbyists.
- Educators and students interested in orbital mechanics.
- General public curious about the ISS's current location and visibility.

## Core Features
- **Real-Time Tracking:** High-frequency (every 2s) position updates via Socket.IO.
- **Orbital Visualization:** Solid cyan path for the past 45 minutes and dashed orange path for the next 45 minutes.
- **Immersive UI:** Dark space aesthetic with glassmorphism panels, utilizing CartoDB Dark Matter map tiles.
- **Visibility Footprint:** A semi-transparent cyan circle (~2,200 km radius) indicating the area where the ISS is visible from the ground.
- **Crew Information:** Live detailed card view of all humans currently in space (ISS and Tiangong), including profile photos, biography links, spacecraft details, and mission duration.
- **Next Pass Prediction:** Browser-based geolocation to predict the next 3 visible passes.
- **Responsive Design:** Seamless experience across desktop and mobile (with a bottom drawer UI for mobile).

## Success Metrics
- **Performance:** Low-latency real-time updates without UI lag.
- **User Experience:** Intuitive map controls and clearly presented telemetry data.
- **Reliability:** Robust handling of external API rate limits and potential downtime.
