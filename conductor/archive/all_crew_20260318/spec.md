# Specification: Fetch All Space Station Crew Members

## Overview
Expand the "Crew Aboard" functionality to include all humans currently in space from all space stations (ISS and Tiangong/CSS). This involves removing station-specific filters and enriching the data structure with spacecraft details, mission duration, and country flags.

## Functional Requirements
- **Data Source Expansion:**
    - Modify the backend fetching logic in `lib/crewFetcher.js` to remove the `iss: true` filter.
    - Include all people returned by the Corquaid API (`people-in-space.json`).
- **Enriched Data Capture:**
    - Capture new fields for each astronaut: `spacecraft`, `launched` (for duration), and `flag_code` (for flags).
- **UI Enhancement:**
    - Update the `crew-list` in `public/index.html` to display the new data.
    - Add a "Station" indicator or tag to distinguish between ISS and Tiangong members.
    - Display the spacecraft name.
    - Show the country flag (using an icon or flag code).
    - Display the mission duration (calculated from the `launched` timestamp).

## Non-Functional Requirements
- **UI Performance:** Ensure the list remains fluid even with an increased number of crew members.
- **Accuracy:** Mission duration must be calculated accurately based on the current system time.

## Acceptance Criteria
- [ ] Backend fetches all crew members regardless of their space station.
- [ ] UI displays crew members from both ISS and Tiangong.
- [ ] Astronaut cards include spacecraft name, mission duration, and country flag.
- [ ] Data refreshes every 10 minutes as per the existing cron schedule.

## Out of Scope
- Tracking the real-time position of the Tiangong space station on the map (this track is crew-only).
- Historical crew logs.
