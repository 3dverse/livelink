# TODO

## Critical

### Livelink

- [ ] Add a way to get the global transfrom of an entity
- [ ] Rewrite WebXR and move it to Livelink.js
- [x] Rename RemoteRenderingSurface to something without "Surface"
- [x] Rethink Input Devices
- [x] Opinionated Camera controller
- [x] Use TypedEventTarget for events
    - Livelink
        - [x] TO_REMOVE\_\_viewports-added
    - Rendering
        - [x] on-entity-picked (Viewport)
        - [x] on-resized (CanvasAutoResizer, RenderingSurface, OffscreenSurface)
    - Entity
        - [x] entity-updated
        - [x] visibility-changed
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

- [x] Move LoadingOverlay from Samples to livelink-react-ui
- [ ] Move DisconnectModal from Samples to livelink-react-ui

### Samples

- [ ] Camera controller Fly mode
- [ ] Camera controller Orbit mode
- [ ] Controller settings
- [ ] Scene refs

## Nice to have

- [ ] Check if it's worth using https://github.com/ros2jsguy/threejs-math

## Internal ?

- [ ] Livelink.viewports
- [ ] Client.camera_rtids
- [ ] Entity.auto_update
- [ ] Entity.auto_broadcast
- [ ] Entity.findEntities
