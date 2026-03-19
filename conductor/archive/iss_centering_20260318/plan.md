# Implementation Plan: ISS Centering and Follow Logic

## Phase 1: Frontend Logic (Centering and Zoom)

### Task 1.1: Implement Initial Centering
    - [x] Task: Write Tests for Initial Centering
    - [x] Create `public/js/tests/centering.test.js` (or similar, depending on existing test setup).
    - [x] Mock Socket.IO `iss:position` event.
    - [x] Verify that `map.setView()` or `map.panTo()` is called with the ISS coordinates upon the first update.
- [x] **Task: Implement Initial Centering Logic in `public/js/app.js`**
    - [x] Add a state variable `isInitialCenteringDone = false`.
    - [x] Update the `iss:position` event listener to check `isInitialCenteringDone` and center the map if `false`.
    - [x] Set `isInitialCenteringDone = true` after the first successful center.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Initial Centering' (Protocol in workflow.md) [50a51b8]


### Task 1.2: Dynamic Zooming Based on Footprint
- [x] **Task: Write Tests for Dynamic Zooming**
    - [x] Verify map zoom level is adjusted to fit the ~2,200 km radius circle (visibility footprint).
- [x] **Task: Implement Zoom Fitting Logic**
    - [x] Use `map.fitBounds(footprintCircle.getBounds())` or similar logic to calculate the optimal zoom level.
    - [x] Ensure the "World View" (zoom ~4) is the baseline before fitting the bounds.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Dynamic Zooming' (Protocol in workflow.md) [22f0bab]


## Phase 2: Follow Mode UI and Logic

### Task 2.1: Implement Follow Mode UI
- [x] **Task: Create "Follow ISS" Toggle Button**
    - [x] Add a button to `public/index.html` within the existing telemetry or control panel.
    - [x] Style the button using the established dark space/glassmorphism aesthetic in `public/css/style.css`.
- [x] **Task: Handle Button Click Interaction**
    - [x] Add an event listener in `public/js/app.js` to toggle the "Follow" state.
    - [x] Update button UI (e.g., color, text, or icon) to reflect the active/inactive state.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Follow Mode UI' (Protocol in workflow.md) [73191da]

### Task 2.2: Implement Follow Mode Logic
- [x] **Task: Write Tests for Continuous Following**
    - [x] Mock multiple `iss:position` updates.
    - [x] Verify that the map re-centers when "Follow" mode is active.
- [x] **Task: Implement Continuous Centering**
    - [x] Update the `iss:position` event listener to re-center the map if `isFollowModeActive` is `true`.
- [x] **Task: Disable Follow Mode on Manual Pan (Optional Improvement)**
    - [x] Listen for Leaflet's `movestart` or `dragstart` events triggered by user interaction.
    - [x] Automatically disable "Follow" mode if the user manually moves the map.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Follow Mode Logic' (Protocol in workflow.md) [73191da]

## Phase 3: Final Verification and Cleanup
- [ ] **Task: Run Full Test Suite**
    - [ ] Ensure all unit and integration tests pass.
    - [ ] Verify code coverage for the new centering logic (>80%).
- [ ] **Task: Perform End-to-End Manual Verification**
    - [ ] Load the page and verify auto-centering.
    - [ ] Toggle "Follow" mode and observe map behavior.
    - [ ] Test on mobile viewport to ensure UI responsiveness.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Final Cleanup' (Protocol in workflow.md)**
