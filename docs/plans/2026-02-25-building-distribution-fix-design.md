# Design: Building Distribution and Configuration Refactor

## Problem
Buildings in the cyberpunk skyline would occasionally cluster together and then disappear for long periods. This was caused by:
1.  **Improper Wrap Distance**: The `WRAP_DISTANCE` (60 units) was significantly larger than the actual span of the city (approx 20 units), creating a 40-unit gap of "empty air."
2.  **Hardcoded Values**: Building definitions and parallax logic were hardcoded in `js/environment.js`, making it difficult to tune the environment.

## Solution: Configuration Centralization
All building and environment settings have been moved to the `CONFIG` object in `js/constants.js`.

### New Configuration Structure
```javascript
ENVIRONMENT: {
  PARALLAX_SPEED: 0.025,
  CITY: {
    WRAP_Z: 15.0,
    WRAP_DISTANCE: 30.0, // Reduced from 60 to fix empty gaps
    BUILDINGS: [ ... ],
    DISTANT_BUILDINGS: [ ... ]
  }
}
```

## Implementation Details
1.  **`js/constants.js`**:
    *   Created `CONFIG.ENVIRONMENT`.
    *   Added building coordinate arrays (`BUILDINGS`, `DISTANT_BUILDINGS`).
    *   Tuned `WRAP_DISTANCE` to 40.0 to ensure a tighter loop and constant building presence.
2.  **`js/environment.js`**:
    *   Refactored `createEnvironment` to iterate over `CONFIG.ENVIRONMENT.CITY.BUILDINGS`.
    *   Refactored `updateEnvironment` to use `CONFIG.ENVIRONMENT` values for diagonal movement and wrapping.

## Verification
- **Unit Tests**: `npm run test:unit` confirms environment generation still functions as expected.
- **Visual Check**: Playwright survival tests confirm building movement and rendering are active.
