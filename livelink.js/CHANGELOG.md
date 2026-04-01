# @3dverse/livelink

## 0.8.62

### Patch Changes

- fix(livelink.js): non-primitive scene settings were not correctly updated when their properties were set individually

## 0.8.61

### Patch Changes

- fix(livelink.js): correct bound checks for RelativeRect.from_dom_elements
- fix(livelink.js): removed dead code in Session.close
- fix(livelink.js): throw/log when api calls don't return ok response
- fix(livelink.js): read the exact number of samples in AudioPlayer and don't rely on DataView size
- fix(livelink.js): guard against infinite loop if a filter is ill formed
- fix(livelink.js): clear dangling timeout when releasing canvas auto resizer
- fix(livelink.js): remove dangling listener when a surface is released
- fix(livelink.js): clear meta data map on webcodec decoder release and reset first frame to true in configure
- fix(livelink.js): release pointer lock listener
- fix(livelink.js): moved the viewport listener registration from the surface to the viewport
- fix(livelink.js): remove entity updated listener from camera projection when parent viewport is released
- fix(livelink.js): scene settings with primitive values were not correctly updated
- fix(livelink.js): unified how input devices are enabled/disabled through a base class
- fix(livelink.js): guarded keyboard enable/disable functions against reentry
- fix(livelink.js): entities were not correctly removed from the entity registry
- fix(livelink.js): close video frame no meta data is found
- docs(livelink.js): document scene settings
- fix(livelink.js): test return value of mat4.invert for null instead of the param which is always truthy
- fix(livelink.js): removed useless frame_timestamp accessor
- fix(livelink.js): euler orientation was not always correctly computed
- fix(livelink.js): remove the camera update listener when releasing the camera controller
- fix(livelink.js): correctly release gl resources when ContextWebGL is released

## 0.8.60

### Patch Changes

- feat(livelink.js): add view_from_world_matrix, is_perspective and is_orthographic in CameraProjection

## 0.8.59

### Patch Changes

- fix(livelink.js): activating picking on a viewport no longer stops the propagation of mouse events.

## 0.8.58

### Patch Changes

- feat(livelink.js): add overlays draw call to OffscreenSurface so WebXR can display dom overlays

## 0.8.57

### Patch Changes

- fix(livelink.js): fix global transform computation
- fix(livelink.js): adding and removing a component from an entity between two broadcast loops may result in unpredictable behavior

## 0.8.56

### Patch Changes

- feat(livelink.js): propagate script event without target to all entities
- feat(livelink.js): add connection stages

## 0.8.55

### Patch Changes

- fix(livelink.js): ensure to not break WebCodecsDecoder in case the resize request was denied
- chore: update dependencies
- feat(livelink.js): expose threejs-math functions
- feat(livelink.js): add scale option to OffscreenSurface & RenderingSurface for High-DPI displays (Window.devicePixelRatio)
- fix(livelink.js): resize request was not always correctly submitted

## 0.8.54

### Patch Changes

- fix(livelink.js): fix an issue where update requests could be send with deleted entities
- fix(livelink.js): resize was not always triggered in some situations
- fix(livelink.js): activating picking on a viewport no longer stops the propagation of mouse click events.
- refactor(livelink.js): surface add and remove viewports functions are now internal

## 0.8.53

### Patch Changes

- feat(livelink.js): scene settings can now be altered
- feat(livelink.js): added Scene.getInfo
- fix(livelink.js): lineage component was missing on Entity

## 0.8.52

### Patch Changes

- feat(livelink.js): add includes method in EntityUpdatedEvent
- chore(livelink.js): update livelink.core
- fix(livelink.js): adjust frame size and fix video decoding on iOS devices

## 0.8.51

### Patch Changes

- feat: add entity creation and deletion events
- chore: update dependencies
- fix(livelink.js): unregister from client events during disconnection
- feat(livelink.js): add getSettings in Scene
- fix: trigger reparent command as soon a parent is setted

## 0.8.50

### Patch Changes

- feat(livelink.js): expose last frame delta time to compute fps
- feat: implement detach-components command & event
- chore: updated dependencies
- refactor: implement new client api, allowing headless clients to see other client
- feat(livelink.js): implement viewer suspend and resume using page visibility API
- fix: correct docs urls
- chore: update dependencies
- feat: add camera speed slider and sample
- feat: entity reparent

## 0.8.49

### Patch Changes

- fix(livelink.js): do not initialize audio context for headless client

## 0.8.48

### Patch Changes

- feat(livelink.js): headless mode for clients
- chore: update dependencies
- refactor(livelink.js): replaced configureHeadlessClient by startHeadlessClient
- docs: fixed warnings

## 0.8.47

### Patch Changes

- feat(livelink.js): initialize entity visibility state and handle progatation of the visibility state across children

## 0.8.46

### Patch Changes

- fix(livelink.js): assign component attribute values before emitting the update event
- feat(livelink.js): introduce change_source for EntityVisibilityChangedEvent

## 0.8.45

### Patch Changes

- fix(livelink.js): do not recreate child entities if they're already in the registry

## 0.8.44

### Patch Changes

- chore: update dependencies
- chore: update dependencies

## 0.8.43

### Patch Changes

- chore: update dependencies
- docs(livelink.js): add missing urls to repo, bugs, and homepage to package.json

## 0.8.42

### Patch Changes

- fix(livelink.js): truck only for the camera controller fly preset when using 2 touches because dolly & truck does not aim well in this mode

## 0.8.41

### Patch Changes

- docs(livelink.js): documentation category for gamepad related types
- fix(livelink.js): camera controller issue where simple click locks the pointer on next mouse move, and secure the lock pointer aim when the user uses escape key to unlock.
- fix(livelink.js): secure pointer lock API calls from CameraController because safari for iOS fires mouse events on touch actions

## 0.8.40

### Patch Changes

- chore: updated all packages and fixed build
- chore(livelink.js): update livelink-camera-controls

## 0.8.39

### Patch Changes

- feat(livelink.react.ui): add virtual gamepad and virtual joystick components

## 0.8.38

### Patch Changes

- fix(livelink.js): upgrade livelink-camera-controls to fix dolly to cursor feature since aspectRatio is not handled by the lens components anymore

## 0.8.37

### Patch Changes

- fix(livelink.js): delete metadata when it has been used

## 0.8.36

### Patch Changes

- feat: experimental implementation of audio streaming and playback

## 0.8.35

### Patch Changes

- chore(livelink.js): update livelink-core version

## 0.8.34

### Patch Changes

- fix(livelink.js): fixed types

## 0.8.33

### Patch Changes

- refactor(livelink.js): moved WebXR drawing context from livelink to new livelink-webxr package
- fix: automatically stretch image when the streaming resolution is lower than requested

## 0.8.32

### Patch Changes

- fix(livelink.js): fixes an issue with the disconnect function preventing viewports from being removed correctly

## 0.8.31

### Patch Changes

- fix(livelink.js): reversed mouse wheel direction with truck and screen pan actions on default camera controller

## 0.8.30

### Patch Changes

- feat(livelink.js): add guest token support
- fix(livelink.js): do not attempt to close the session when calling disconnect

## 0.8.29

### Patch Changes

- refactor: removed deprecated auto_update option
- docs: removed broken link
- docs: small refactor to improve the docs
- docs: do not hide page title
- docs: moved TO_REMOVE functions at the bottom of the file so they appear last in the docs
- fix(livelink.js): emit EntityVisibilityChangedEvent when an entity visibility state is toggled
- refactor: mainly for docs

## 0.8.28

### Patch Changes

- fix(livelink.js): fix headless client configuration

## 0.8.27

### Patch Changes

- fix(livelink.js): fix node.js compatiblity

## 0.8.26

### Patch Changes

- chore(livelink.js): bump livelive-camera-controls
- refactor(livelink.js): use global_transform in camera update
- fix(livelink.js): wrong forward vector used by forward_target_distance option of CameraControllerPresets.fly
- feat(livelink.js): expose aabb type

## 0.8.25

### Patch Changes

- feat(livelink.js): add fly camera controller, with keyboard controls & camera init options on target position and distance (fly mode needs epsilon target). Review camera presets doc and use fly mode on script events sample.
- feat(livelink.js): add an event system to enable listening to server side script events
- refactor(livelink.js): cleaned up livelink listeners lifecycle
- fix(livelink.js): apply initial orientation of the camera to the camera controller

## 0.8.24

### Patch Changes

- chore(docs): more typedoc md options
- feat(livelink.js): add world_euler_orientation in camera projection
- chore(docs): changed generated urls to github
- chore(docs): format markdown output as tables

## 0.8.23

### Patch Changes

- feat(livelink.js): enabling keyboard inputs now prevent default key behavior
- feat(livelink.js): add Entity.global_aabb getter
- chore(livelink.js): bump livelink-core (added label, measure & spline components)
- refactor(livelink.js): keep entity transformation matrices in cache
- feat(livelink.js): add custom options to CameraController exploited by CameraControllerPresets.pointer_locked_orbital

## 0.8.22

### Patch Changes

- perf(livelink.js): recalculate global_transform only if necessary

## 0.8.21

### Patch Changes

- chore(livelink.js): bump livelink-camera-controls

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
