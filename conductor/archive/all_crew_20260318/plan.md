# Implementation Plan: Fetch All Space Station Crew Members

## Phase 1: Backend Data Expansion

### Task 1.1: Update Crew Fetching Logic
    - [x] Task: Write Tests for All-Station Crew Fetching
    - [x] Update `tests/crewFetcher.test.js`.
    - [x] Add a test case for multiple stations (ISS and Tiangong).
    - [x] Verify that new fields (`spacecraft`, `launched`, `flag_code`) are extracted correctly.
    - [x] Verify that no filtering is applied to the `people` array.
- [x] **Task: Update `lib/crewFetcher.js` Implementation**
    - [x] Remove the `iss: true` filter.
    - [x] Update the mapping logic to include `spacecraft`, `launched`, and `flag_code`.
    - [x] Ensure `iss` boolean is still passed to help frontend styling.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend Data Expansion' (Protocol in workflow.md)**

## Phase 2: Frontend UI Enrichment

### Task 2.1: Update Frontend Rendering Logic
- [x] **Task: Write Tests for Enriched Crew Rendering**
    - [x] Update `public/js/tests/crew.test.js`.
    - [x] Verify that the card displays the space station (ISS vs Tiangong).
    - [x] Verify that mission duration is calculated and displayed (e.g., "120 days in space").
    - [x] Verify that the country flag code is rendered (or an img using the code).
- [x] **Task: Update `updateCrew` in `public/js/app.js`**
    - [x] Implement duration calculation from the `launched` timestamp.
    - [x] Update the card template to include the "Station" tag, spacecraft name, and flag icon.
    - [x] Add logic to fetch flag icons (e.g., from `https://flagcdn.com/`).
- [x] **Task: Update Styles in `public/css/style.css`**
    - [x] Add styles for the station tag (color-coded for ISS vs Tiangong).
    - [x] Add styles for the mission duration and flag icons.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Frontend UI Enrichment' (Protocol in workflow.md)**

## Phase 3: Final Verification
- [x] **Task: Run Full Test Suite**
    - [x] Ensure all unit and integration tests pass.
- [x] **Task: Perform End-to-End Manual Verification**
    - [x] Confirm all crew members are listed in the sidebar.
    - [x] Confirm the UI correctly displays the station and mission duration.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Final Verification' (Protocol in workflow.md)
