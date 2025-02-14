# @3dverse/livelink

## 0.8.25

### Patch Changes

-   feat(livelink.js): add fly camera controller, with keyboard controls & camera init options on target position and distance (fly mode needs epsilon target). Review camera presets doc and use fly mode on script events sample.
-   feat(livelink.js): add an event system to enable listening to server side script events
-   refactor(livelink.js): cleaned up livelink listeners lifecycle
-   fix(livelink.js): apply initial orientation of the camera to the camera controller

## 0.8.24

### Patch Changes

-   chore(docs): more typedoc md options
-   feat(livelink.js): add world_euler_orientation in camera projection
-   chore(docs): changed generated urls to github
-   chore(docs): format markdown output as tables

## 0.8.23

### Patch Changes

-   feat(livelink.js): enabling keyboard inputs now prevent default key behavior
-   feat(livelink.js): add Entity.global_aabb getter
-   chore(livelink.js): bump livelink-core (added label, measure & spline components)
-   refactor(livelink.js): keep entity transformation matrices in cache
-   feat(livelink.js): add custom options to CameraController exploited by CameraControllerPresets.pointer_locked_orbital

## 0.8.22

### Patch Changes

-   perf(livelink.js): recalculate global_transform only if necessary

## 0.8.21

### Patch Changes

-   chore(livelink.js): bump livelink-camera-controls

## 0.8.20

### Patch Changes

-   fix(livelink.js): fix frame metadata with webcodecs decoder
-   fix(livelink.js): does not dispatch a resize event if the resolution scale has not changed

## 0.8.19

### Patch Changes

-   fix(livelink.js): apply default values to local_transform component

## 0.8.18

### Patch Changes

-   refactor(livelink.js): update livelink.core and adapted the orthographic projection matrix to the new orthographic_lens component interface
-   docs: update typedoc config to ignore noInheritDoc warnings
-   feat(livelink.js): add global_transform to entity
-   fix(livelink.js): remote surface was not resized correctly under certain conditions
-   refactor(livelink.js): update livelink-camera-controls
-   feat(livelink.js): exposed latency from livelink core

## 0.8.17

### Patch Changes

-   fix(livelink.js): mouse position was not correctly computed in mouse events
-   ci: generate changesets in a separate job to correctly compute them based on the main branch
-   docs(livelink.js): update livelink.react update in README
