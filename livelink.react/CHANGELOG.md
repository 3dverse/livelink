# @3dverse/livelink-react

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
