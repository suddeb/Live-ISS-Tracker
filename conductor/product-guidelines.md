# Product Guidelines

## Prose Style
- **Professional but engaging:** Use concise, informative language with occasional space-themed metaphors where appropriate.
- **Clarity first:** Complex orbital telemetry should be presented clearly with appropriate units (e.g., km, km/h).

## Design & UI/UX
- **Dark Mode only:** The interface should strictly adhere to a dark space aesthetic (e.g., CartoDB Dark Matter tiles).
- **Glassmorphism:** Use semi-transparent panels with soft blurs for telemetry and information boxes.
- **Accents:** Use cyan for ISS position, footprint, and past path; use orange for the future orbital path to provide clear visual distinction.
- **Responsiveness:** Sidebar elements should transition to a bottom drawer on smaller viewports.

## Core Interaction Principles
- **Real-Time Responsiveness:** The map should update fluidly as new position data arrives without sudden jumps or stutters.
- **Information Accessibility:** Telemetry should be easily readable even when overlaid on complex map backgrounds.
- **Minimalistic Overlay:** Avoid cluttering the map view; keep interactive elements prioritized.

## Technology Guidelines
- **Proxying:** All external API requests should be proxied through the backend to avoid CORS issues and manage rate limits.
- **Real-Time Data:** Socket.IO is the primary vehicle for all live updates.
- **Client-Side Rendering:** Use Leaflet.js for all map-related rendering tasks to ensure a smooth, interactive experience.
