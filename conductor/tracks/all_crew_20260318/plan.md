# Implementation Plan: Fetch All Space Station Crew Members

## Phase 1: Backend Data Expansion

### Task 1.1: Update Crew Fetching Logic
- [ ] **Task: Write Tests for All-Station Crew Fetching**
    - [ ] Update `tests/crewFetcher.test.js`.
    - [ ] Add a test case for multiple stations (ISS and Tiangong).
    - [ ] Verify that new fields (`spacecraft`, `launched`, `flag_code`) are extracted correctly.
    - [ ] Verify that no filtering is applied to the `people` array.
- [ ] **Task: Update `lib/crewFetcher.js` Implementation**
    - [ ] Remove the `iss: true` filter.
    - [ ] Update the mapping logic to include `spacecraft`, `launched`, and `flag_code`.
    - [ ] Ensure `iss` boolean is still passed to help frontend styling.
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Backend Data Expansion' (Protocol in workflow.md)**

## Phase 2: Frontend UI Enrichment

### Task 2.1: Update Frontend Rendering Logic
- [ ] **Task: Write Tests for Enriched Crew Rendering**
    - [ ] Update `public/js/tests/crew.test.js`.
    - [ ] Verify that the card displays the space station (ISS vs Tiangong).
    - [ ] Verify that mission duration is calculated and displayed (e.g., "120 days in space").
    - [ ] Verify that the country flag code is rendered (or an img using the code).
- [ ] **Task: Update `updateCrew` in `public/js/app.js`**
    - [ ] Implement duration calculation from the `launched` timestamp.
    - [ ] Update the card template to include the "Station" tag, spacecraft name, and flag icon.
    - [ ] Add logic to fetch flag icons (e.g., from `https://flagcdn.com/`).
- [ ] **Task: Update Styles in `public/css/style.css`**
    - [ ] Add styles for the station tag (color-coded for ISS vs Tiangong).
    - [ ] Add styles for the mission duration and flag icons.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Frontend UI Enrichment' (Protocol in workflow.md)**

## Phase 3: Final Verification
- [ ] **Task: Run Full Test Suite**
    - [ ] Ensure all unit and integration tests pass.
- [ ] **Task: Perform End-to-End Manual Verification**
    - [ ] Confirm all crew members are listed in the sidebar.
    - [ ] Confirm the UI correctly displays the station and mission duration.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Final Verification' (Protocol in workflow.md)**
