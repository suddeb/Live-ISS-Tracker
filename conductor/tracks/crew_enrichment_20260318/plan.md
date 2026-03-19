# Implementation Plan: Enhanced Crew Information

## Phase 1: Backend Data Migration

### Task 1.1: Update Astronaut Fetching Logic
- [ ] **Task: Write Tests for Backend Crew Fetching**
    - [ ] Create `tests/crewFetcher.test.js` (or integrate into existing backend tests).
    - [ ] Mock Axios to return a sample Corquaid API response.
    - [ ] Verify that the fetching logic correctly filters for `iss: true`.
    - [ ] Verify that all required fields (`name`, `agency`, `position`, `country`, `url`, `image`) are extracted.
- [ ] **Task: Implement Corquaid API Integration in `server.js`**
    - [ ] Update the `broadcastAstronauts` function to use the new API URL.
    - [ ] Implement filtering and mapping to the enriched data structure.
    - [ ] Update the `cron.schedule` to `*/10 * * * *` (every 10 minutes).
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Backend Data Migration' (Protocol in workflow.md)**

## Phase 2: Frontend Card-Based UI

### Task 2.1: Implement Card View Styling
- [ ] **Task: Update `public/css/style.css` for Crew Cards**
    - [ ] Define styles for `.crew-card`, including glassmorphism effects, profile photo containers, and typography.
    - [ ] Add responsive rules for card grid/layout in the sidebar.
    - [ ] Add styles for placeholder profile images.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Card View Styling' (Protocol in workflow.md)**

### Task 2.2: Implement Dynamic Card Rendering
- [ ] **Task: Write Tests for Frontend Crew Rendering**
    - [ ] Update `public/js/tests/centering.test.js` or create a new test for `updateCrew`.
    - [ ] Verify that `updateCrew` correctly generates HTML for astronaut cards with links and images.
- [ ] **Task: Update `updateCrew` Logic in `public/js/app.js`**
    - [ ] Refactor the template literal in `updateCrew` to generate the card-based HTML.
    - [ ] Ensure profile photos have a fallback mechanism if the source URL fails or is missing.
    - [ ] Ensure all links open in a new tab.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Dynamic Card Rendering' (Protocol in workflow.md)**

## Phase 3: Integration and Final Polish

### Task 3.1: Final Integration Testing
- [ ] **Task: End-to-End Verification**
    - [ ] Verify that real-time updates from the backend correctly trigger UI refreshes every 10 minutes.
    - [ ] Verify responsive behavior on simulated mobile viewports.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Integration and Final Polish' (Protocol in workflow.md)**
