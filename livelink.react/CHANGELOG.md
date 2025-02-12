# @3dverse/livelink-react

## 0.2.36

### Patch Changes

-   chore(docs): more typedoc md options
-   refactor(livelink.js): simplified session open mode using strict union to accept exclusively one mode or the other
-   chore(docs): changed generated urls to github
-   chore(docs): format markdown output as tables
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.24

## 0.2.35

### Patch Changes

-   feat(livelink.js): add custom options to CameraController exploited by CameraControllerPresets.pointer_locked_orbital
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.23

## 0.2.34

### Patch Changes

-   feat(livelink.react): now compatible with react 19
-   Updated dependencies
    -   @3dverse/livelink@0.8.21

## 0.2.33

### Patch Changes

-   chore(livelink.react): get rid of WebXRInputRelay and its @webxr-input-profiles/motion-controllers dependency as it's only used by the mobile viewer app and not ready for any generic webxr app
-   feat(livelink.react): add resolutionScale and onSessionEnd property to WebXR component
-   fix(livelink.react): allow to reconfigure the viewport of a XR session
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.20

## 0.2.32

### Patch Changes

-   feat(livelink.react): allowed lens to be passed to useCameraEntity hook, and refactored the hook interface to be more typedoc friendly
-   fix(livelink.react.ui): add storybook
-   feat(livelink.react): webxrhelper, expose reference_space getter and make session and mode non public with getters
-   refactor(livelink.react): moved StrictUnion utility type to a utils file
-   refactor: slight changes following last livelink.js changes
-   fix: react-ui theme
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.18

## 0.2.31

### Patch Changes

-   fix(livelink.react): webxr, touches the screen makes the XRFrame rendering loop to crash because it tries to get XRFrame pose although the XRInputSource.gridSpace does not exist
-   fix(livelink.react): attach webXR camera tag and lens at entity creation
-   ci: generate changesets in a separate job to correctly compute them based on the main branch
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.17
