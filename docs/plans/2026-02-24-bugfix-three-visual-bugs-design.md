# Design: Fix Three Visual Bugs After Camera Angle Change

## Context

The camera was moved from a front-on view to a 45-degree over-the-shoulder angle at (15, 5, 15). Three visual bugs resulted, all confirmed via Gemini video analysis.

## Bug 1: Background Invisible

**Problem:** Buildings in `environment.js` are 1-unit-deep boxes at z=-43 to -48, facing +Z. From the angled camera they are edge-on and invisible. Ground/grid at z=-60 is mostly out of view.

**Fix:** Reposition the entire environment to face the camera's viewing direction. Make buildings thicker (3D boxes, not flat). Reposition ground and grid to be visible from (15,5,15) looking at origin — they should extend along the camera's line of sight rather than being far behind the action.

**Files:** `js/environment.js`

## Bug 2: Bird Trail Physics Wrong

**Problem:** Trail in `trail.js` offsets each point by `- i * 0.15` on Z axis and adds X wobble. From the old front camera this looked like a trail behind the bird. From the angled camera, the Z-offset creates a downward/arc artifact because the Z axis now points toward/away from the camera diagonally.

**Fix:** The bird flies in the -Z direction (pipes come from -Z toward +Z). The trail should extend behind the bird in -Z. Currently the trail stores world positions correctly, but `_rebuildBuffer` artificially offsets Z by `- i * 0.15`, pushing older points further from the camera. Remove this artificial Z offset — the natural position history already creates a trail as the bird moves. The X wobble can stay but should be reduced since it's now visible from the side.

**Files:** `js/trail.js`

## Bug 3: Pipes Disappear Too Early

**Problem:** In `game.js` line 142, pipes are removed when `p.group.position.z > 2`. The camera is at z=15, so z=2 is still well within view. Pipes vanish the moment they pass the bird.

**Fix:** Increase the removal threshold to `z > 15` so pipes remain visible as the bird flies past them, only removed once they're behind the camera.

**Files:** `js/game.js` (one line change)

## Verification Plan

For each fix:
1. Write/update unit tests covering the changed logic
2. Run unit tests to confirm pass
3. Record gameplay video via Playwright
4. Use `/verify-video` to confirm the specific bug is resolved
5. Commit the fix
