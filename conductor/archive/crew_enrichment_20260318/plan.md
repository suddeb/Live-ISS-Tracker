# Implementation Plan: Enhanced Crew Information

## Phase 1: Backend Data Migration

### Task 1.1: Update Astronaut Fetching Logic
    - [x] Task: Write Tests for Backend Crew Fetching
    - [x] Create `tests/crewFetcher.test.js` (or integrate into existing backend tests).
    - [x] Mock Axios to return a sample Corquaid API response.
    - [x] Verify that the fetching logic correctly filters for `iss: true`.
    - [x] Verify that all required fields (`name`, `agency`, `position`, `country`, `url`, `image`) are extracted.
- [x] **Task: Implement Corquaid API Integration in `server.js`**
    - [x] Update the `broadcastAstronauts` function to use the new API URL.
    - [x] Implement filtering and mapping to the enriched data structure.
    - [x] Update the `cron.schedule` to `*/10 * * * *` (every 10 minutes).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend Data Migration' (Protocol in workflow.md) [8e76d5b]


## Phase 2: Frontend Card-Based UI

### Task 2.1: Implement Card View Styling
- [x] **Task: Update `public/css/style.css` for Crew Cards**
    - [x] Define styles for `.crew-card`, including glassmorphism effects, profile photo containers, and typography.
    - [x] Add responsive rules for card grid/layout in the sidebar.
    - [x] Add styles for placeholder profile images.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Card View Styling' (Protocol in workflow.md) [f820b3c]


### Task 2.2: Implement Dynamic Card Rendering
- [x] **Task: Write Tests for Frontend Crew Rendering**
    - [x] Update `public/js/tests/centering.test.js` or create a new test for `updateCrew`.
    - [x] Verify that `updateCrew` correctly generates HTML for astronaut cards with links and images.
- [x] **Task: Update `updateCrew` Logic in `public/js/app.js`**
    - [x] Refactor the template literal in `updateCrew` to generate the card-based HTML.
    - [x] Ensure profile photos have a fallback mechanism if the source URL fails or is missing.
    - [x] Ensure all links open in a new tab.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Dynamic Card Rendering' (Protocol in workflow.md) [93eeab3]


## Phase 3: Integration and Final Polish

### Task 3.1: Final Integration Testing
- [x] **Task: End-to-End Verification**
    - [x] Verify that real-time updates from the backend correctly trigger UI refreshes every 10 minutes.
    - [x] Verify responsive behavior on simulated mobile viewports.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Integration and Final Polish' (Protocol in workflow.md)
