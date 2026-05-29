# @3dverse/livelink-react

## 0.2.64

### Patch Changes

- chore: update dependencies
- chore: update dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.63

## 0.2.63

### Patch Changes

- fix(livelink.react): viewports are now correctly released before the surfaces
- fix(livelink.react): render_target_index prop in Viewport can now be updated
- docs(livelink.react): update DOM3DAnchor and DOM3DEntityAnchor docs
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.61

## 0.2.62

### Patch Changes

- feat(livelink.react): renamed DOM3DElement to DOM3DAnchor and introduced DOM3DDiv
- Updated dependencies
  - @3dverse/livelink@0.8.60

## 0.2.61

### Patch Changes

- fix(livelink.react): remove scaleFactor and overlay prop injection into React3DElement DOM
- Updated dependencies
  - @3dverse/livelink@0.8.59

## 0.2.60

### Patch Changes

- feat(livelink.react): add onProjectionChange to DOM3DElement
- fix(livelink.js): useEntity and useEntities now delete entities when unmounted if they have been created
- feat(livelink.react): add HTMLAttributes and DOMAttributes props to DOM3DElement

## 0.2.59

### Patch Changes

- feat(livelink.react): implement livelink connection stages
- feat(livelink.react): add defaultFilename property to Recorder component
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.56

## 0.2.58

### Patch Changes

- chore: update dependencies
- feat(livelink.react): add scale option to Canvas component
- feat(livelink.react): add onSuccess and onCancel properties to Recorder component
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.55

## 0.2.57

### Patch Changes

- fix(livelink.react): unmount useCamera hook now disposes of the entity camera
- refactor(livelink.react): Viewports are now delaying their resize to not spam the resize requests
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.54

## 0.2.56

### Patch Changes

- feat(livelink.react): scene settings can now be altered
- feat(livelink.react): added useSceneInfo
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.53

## 0.2.55

### Patch Changes

- feat(livelink.react): export scene settings

## 0.2.54

### Patch Changes

- feat(livelink.react): useEntity now accept instances of Entity
- feat(livelink.react): add useEntities
- chore: update dependencies
- feat(livelink.react): add useSceneSettings
- feat(livelink.react): useCameraEntity now use scene default setting for the camera
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.51

## 0.2.53

### Patch Changes

- chore: updated dependencies
- chore: update dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.50

## 0.2.52

### Patch Changes

- fix(livelink-react): fix recorder for firefox
- chore: update dependencies
- docs: fixed warnings
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.48

## 0.2.51

### Patch Changes

- docs(livelink.react): export EntityProvider type
- Updated dependencies
  - @3dverse/livelink@0.8.47

## 0.2.50

### Patch Changes

- chore: update dependencies
- chore: update dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.44

## 0.2.49

### Patch Changes

- chore: update dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.43

## 0.2.48

### Patch Changes

- chore: updated all packages and fixed build
- feat(livelink.react): handle entity visibility changed event in useEntity
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.40

## 0.2.47

### Patch Changes

- feat(livelink-react): add recorder component

## 0.2.46

### Patch Changes

- fix: automatically stretch image when the streaming resolution is lower than requested
- refactor(livelink.react): moved WebXR components from livelink-react to new livelink-webxr package
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.33

## 0.2.45

### Patch Changes

- fix(livelink.react): useEntity no longer triggers re-render with some specific props
- refactor(livelink-react): useEntity property `names` used to find an entity with its name has been renamed to `name`

## 0.2.44

### Patch Changes

- feat: adapt near plane distance to respect the scale of the cameras_origin which alter the pupillary distance on stereovision headsets

## 0.2.43

### Patch Changes

- feat(livelink.react): webxr, added scale to the origin transformation of the cameras

## 0.2.42

### Patch Changes

- feat(livelink.react): add guest token support
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.30

## 0.2.41

### Patch Changes

- feat(livelink.react): expose livelink viewport created by the Viewport component through a ref

## 0.2.40

### Patch Changes

- feat(livelink.react): DOMEntity now react to the entity visibility state
- docs(livelink.react): put contexts variable in their own category, moved components with context providers to the component category
- docs: do not hide page title
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.29

## 0.2.39

### Patch Changes

- feat(livelink.react): add anchor property to dom 3d elements

## 0.2.38

### Patch Changes

- fix(livelink.react): add @types/webxr as a peer dependency

## 0.2.37

### Patch Changes

- refactor(livelink.react): reimplement React overlay with portal, allowing DOM3DElement children to access context provided by the parent tree
- fix: correctly initialize DOMEntity initial position
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.26

## 0.2.36

### Patch Changes

- chore(docs): more typedoc md options
- refactor(livelink.js): simplified session open mode using strict union to accept exclusively one mode or the other
- chore(docs): changed generated urls to github
- chore(docs): format markdown output as tables
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.24

## 0.2.35

### Patch Changes

- feat(livelink.js): add custom options to CameraController exploited by CameraControllerPresets.pointer_locked_orbital
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.23

## 0.2.34

### Patch Changes

- feat(livelink.react): now compatible with react 19
- Updated dependencies
  - @3dverse/livelink@0.8.21

## 0.2.33

### Patch Changes

- chore(livelink.react): get rid of WebXRInputRelay and its @webxr-input-profiles/motion-controllers dependency as it's only used by the mobile viewer app and not ready for any generic webxr app
- feat(livelink.react): add resolutionScale and onSessionEnd property to WebXR component
- fix(livelink.react): allow to reconfigure the viewport of a XR session
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.20

## 0.2.32

### Patch Changes

- feat(livelink.react): allowed lens to be passed to useCameraEntity hook, and refactored the hook interface to be more typedoc friendly
- fix(livelink.react.ui): add storybook
- feat(livelink.react): webxrhelper, expose reference_space getter and make session and mode non public with getters
- refactor(livelink.react): moved StrictUnion utility type to a utils file
- refactor: slight changes following last livelink.js changes
- fix: react-ui theme
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.18

## 0.2.31

### Patch Changes

- fix(livelink.react): webxr, touches the screen makes the XRFrame rendering loop to crash because it tries to get XRFrame pose although the XRInputSource.gridSpace does not exist
- fix(livelink.react): attach webXR camera tag and lens at entity creation
- ci: generate changesets in a separate job to correctly compute them based on the main branch
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.17
