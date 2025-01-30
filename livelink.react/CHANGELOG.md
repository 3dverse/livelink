# @3dverse/livelink-react

## 0.2.31

### Patch Changes

- fix(livelink.react): webxr, touches the screen makes the XRFrame rendering loop to crash because it tries to get XRFrame pose although the XRInputSource.gridSpace does not exist
- fix(livelink.react): attach webXR camera tag and lens at entity creation
- ci: generate changesets in a separate job to correctly compute them based on the main branch
- Updated dependencies
- Updated dependencies
- Updated dependencies
    - @3dverse/livelink@0.8.17
