# TODO

## Critical

### Livelink

- [ ] Rethink Input Devices
- [x] Opinionated Camera controller
- [ ] Use TypedEventTarget for events
    - Livelink
        - [x] TO_REMOVE\_\_viewports-added
    - Rendering
        - [ ] on-entity-picked (Viewport)
        - [ ] on-resized (CanvasAutoResizer, RenderingSurface, OffscreenSurface)
    - Entity
        - [ ] entity-updated
        - [ ] visibility-changed
    - Session
        - [x] on-disconnected
        - [x] client-joined
        - [x] client-left
- [x] Check if we can save on Entity Proxy by defining accessors for each component
    - One drawback is that we can't delete components with `delete entity.component`
    - We can use `entity.component = undefined` instead

### Livelink React

- [ ] useEntities = search for multiple entities

### Livelink React UI

- [x] Move LoadingOverlay to from Samples to livelink-react-ui
- [ ] Move DisconnectModal to from Samples to livelink-react-ui

### Samples

- [ ] Camera controller Fly mode
- [ ] Camera controller Orbit mode
- [ ] Controller settings
- [ ] Scene refs

## Nice to have

- [ ] Check if it's worth using https://github.com/ros2jsguy/threejs-math
