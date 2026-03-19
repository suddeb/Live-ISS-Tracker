# Specification: ISS Centering and Follow Logic

## Overview
Implement the logic to automatically center the Leaflet map on the International Space Station's (ISS) position upon the first real-time update. This track also introduces a toggleable "Follow" mode to keep the ISS centered as its position changes.

## Functional Requirements
- **Initial Auto-Center:** When the application loads and the first `iss:position` event is received via Socket.IO, the map must automatically center on the ISS.
- **Follow Mode Toggle:** Provide a UI button (e.g., a "Follow ISS" button in a glassmorphism panel) to toggle whether the map continuously re-centers on the ISS as it moves.
- **Dynamic Zooming:** Upon initial centering, the map zoom level should be adjusted to "World View" (approx. zoom level 4), but modified to ensure the entire visibility footprint (~2,200 km radius circle) is contained within the viewport.
- **Live Sync:** The centering logic must wait for the first *live* position update from the server to ensure accuracy.

## Non-Functional Requirements
- **Smooth Transitions:** Use Leaflet's `panTo` or `flyTo` methods to provide a smooth visual transition when centering.
- **Performance:** Ensure that continuous centering in "Follow" mode does not hinder map interaction or performance.
- **Responsive UI:** The "Follow" toggle must be easily accessible on both desktop and mobile layouts.

## Acceptance Criteria
- [ ] Map centers on the ISS coordinates upon the first received `iss:position` update.
- [ ] Initial zoom level correctly encapsulates the visibility footprint circle.
- [ ] A "Follow ISS" button exists and correctly toggles continuous centering.
- [ ] When "Follow" is active, manual panning by the user should (optionally) disable "Follow" mode to prevent jarring UI behavior.

## Out of Scope
- Implementing custom map tiles or markers beyond the current set.
- Historical orbital path centering (focus is on the current position).
