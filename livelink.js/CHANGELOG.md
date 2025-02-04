# @3dverse/livelink

## 0.8.20

### Patch Changes

- fix(livelink.js): fix frame metadata with webcodecs decoder
- fix(livelink.js): does not dispatch a resize event if the resolution scale has not changed

## 0.8.19

### Patch Changes

- fix(livelink.js): apply default values to local_transform component

## 0.8.18

### Patch Changes

- refactor(livelink.js): update livelink.core and adapted the orthographic projection matrix to the new orthographic_lens component interface
- docs: update typedoc config to ignore noInheritDoc warnings
- feat(livelink.js): add global_transform to entity
- fix(livelink.js): remote surface was not resized correctly under certain conditions
- refactor(livelink.js): update livelink-camera-controls
- feat(livelink.js): exposed latency from livelink core

## 0.8.17

### Patch Changes

- fix(livelink.js): mouse position was not correctly computed in mouse events
- ci: generate changesets in a separate job to correctly compute them based on the main branch
- docs(livelink.js): update livelink.react update in README
