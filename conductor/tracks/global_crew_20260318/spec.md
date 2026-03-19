# Specification: Fetch and Categorize All Global Crew Members

## Overview
Ensure the application fetches all human personnel currently in orbit (including ISS and Tiangong) without agency filtering. Enhance the UI to group members by agency and display rich metadata including agency icons and specific mission roles.

## Functional Requirements
- **Comprehensive Fetching:** Verify and ensure `lib/crewFetcher.js` retrieves all records from the Corquaid API without station or agency exclusion.
- **Agency Grouping:** Update the frontend to group crew members by their space agency (e.g., NASA, Roscosmos, ESA, CMSA, etc.) in the "Crew Aboard" panel.
- **Agency Branding:** Integrate agency icons/logos into the crew cards for immediate visual identification.
- **Detailed Roles:** Display the specific mission role/title for each member (e.g., Commander, Flight Engineer, Payload Specialist).
- **Data Enrichment:** Ensure fields like `agency`, `position`, `spacecraft`, and `flag_code` are fully utilized.

## Non-Functional Requirements
- **UI Organization:** The sidebar should handle grouping elegantly (e.g., collapsible sections or clear headers).
- **Performance:** Dynamic grouping should not impact page load or real-time update smoothness.

## Acceptance Criteria
- [ ] Backend fetches all 10+ people currently in space.
- [ ] UI displays crew members grouped by their respective space agencies.
- [ ] Each astronaut card shows a recognizable agency icon.
- [ ] Mission roles are clearly visible on every card.
- [ ] Links to biographies remain functional.

## Out of Scope
- Real-time tracking of non-ISS stations on the map.
- Historical data for past expeditions.
