# Implementation Plan: Global Crew Grouping and Branding

## Phase 1: Backend Verification

### Task 1.1: Ensure Comprehensive Fetching
- [x] **Task: Write Tests for Full Crew Response**
    - [x] Update `tests/crewFetcher.test.js` to include multiple agencies (NASA, Roscosmos, ESA, CMSA).
    - [x] Verify that no agency is filtered out.
- [x] **Task: Verify `lib/crewFetcher.js` Mapping**
    - [x] Ensure all required fields for grouping (`agency`) are consistently mapped.
- [x] **Task: Conductor - User Manual Verification 'Phase 1: Backend Verification' (Protocol in workflow.md)**

## Phase 2: Frontend Grouping and Icons

### Task 2.1: Update Styles for Agency Branding
- [x] **Task: Add Agency Icon Styles in `public/css/style.css`**
    - [x] Define classes for major agencies (NASA, RSA, ESA, CMSA, JAXA).
    - [x] Add grouping header styles (e.g., distinct dividers).
- [x] **Task: Conductor - User Manual Verification 'Phase 2: UI Styling' (Protocol in workflow.md)**

### Task 2.2: Implement Dynamic Grouping Logic
- [x] **Task: Write Tests for Grouped Rendering**
    - [x] Update `public/js/tests/crew.test.js` to mock a diverse crew.
    - [x] Verify that the DOM contains agency-specific headers.
    - [x] Verify that cards are nested under correct agency sections.
- [x] **Task: Update `updateCrew` in `public/js/app.js`**
    - [x] Implement logic to sort and group the crew array by `agency`.
    - [x] Update the HTML generation to include agency headers and icons.
    - [x] Ensure the count badge reflects the total number of orbital personnel.
- [x] **Task: Conductor - User Manual Verification 'Phase 2: Grouping Logic' (Protocol in workflow.md)**

## Phase 3: Final Integration
- [~] **Task: End-to-End Verification**
    - [ ] Confirm all 10+ people are visible and correctly categorized.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Final Integration' (Protocol in workflow.md)**
