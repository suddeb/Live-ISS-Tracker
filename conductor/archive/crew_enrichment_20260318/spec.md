# Specification: Enhanced Crew Information via Corquaid API

## Overview
Replace the existing ISS crew data source (`open-notify.org`) with the more detailed Corquaid API (`people-in-space.json`). This track will enrich the "Crew Aboard" panel with extra astronaut details and transition the UI from a simple list to a richer card-based view.

## Functional Requirements
- **Data Source Migration:** 
    - Switch backend fetching from `http://api.open-notify.org/astros.json` to `https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json`.
    - Filter the `people` array to only include members currently on the ISS (`iss: true`).
- **Enhanced Data Handling:**
    - Capture the following fields for each astronaut: `name`, `agency`, `position`, `country`, `url` (biography), and `image` (profile photo).
- **Optimized Fetching:**
    - Update the backend cron schedule to refresh crew data every 10 minutes instead of every 60 seconds.
- **Card-Based UI:**
    - Transform the `crew-list` in `public/index.html` to support a card layout.
    - Each card should display the astronaut's photo (if available), name, position, and agency.
    - Provide a clickable link/button to the astronaut's biography (`url`).

## Non-Functional Requirements
- **Graceful Fallback:** If the profile image fails to load, show a default astronaut placeholder icon.
- **Responsive Layout:** Ensure the card view scales well on mobile devices, potentially switching to a single-column or horizontal scroll layout.
- **Security:** Ensure all external links (`url`) open in a new tab with `rel="noopener noreferrer"`.

## Acceptance Criteria
- [ ] Backend successfully fetches and parses data from the Corquaid API.
- [ ] Crew list accurately reflects only those on the ISS.
- [ ] The "Crew Aboard" panel displays astronaut cards with names and bio links.
- [ ] Profile photos are displayed correctly with fallbacks for broken links.
- [ ] Data refreshes automatically every 10 minutes.

## Out of Scope
- Displaying data for astronauts on the Tiangong space station (CSS).
- Implementing a persistent database for crew history.
