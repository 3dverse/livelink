# TODO

## Critical

- [ ] Camera controllers
- [ ] Use TypedEventTarget for events
    - Livelink
        - [ ] viewports-added
    - Rendering
        - [ ] on-entity-picked (Viewport)
        - [ ] on-resized (CanvasAutoResizer, RenderingSurface, OffscreenSurface)
    - Entity
        - [ ] entity-updated
        - [ ] visibility-changed
    - Session
        - [ ] on-disconnected
        - [ ] client-joined
        - [ ] client-left
- [x] Check if we can save on Entity Proxy by defining accessors for each component
    - One drawback is that we can't delete components with `delete entity.component`
    - We can use `entity.component = undefined` instead

## Nice to have

- [ ] Check if it's worth using https://github.com/ros2jsguy/threejs-math
