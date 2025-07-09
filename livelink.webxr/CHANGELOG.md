# @3dverse/livelink-webxr

## 0.1.9

### Patch Changes

-   chore: removed useless package-lock
-   fix(livelink.webxr): reset xr session state when it's released
-   chore: update dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.44
    -   @3dverse/livelink-react@0.2.50

## 0.1.8

### Patch Changes

-   chore: updated all packages and fixed build
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.40
    -   @3dverse/livelink-react@0.2.48

## 0.1.7

### Patch Changes

-   feat(livelink.webxr): better alpha blend in XRContext fragment shader for immersive-ar sessions, and optional alpha scale to see through opaque surface while using immersive-ar
-   feat(livelink.webxr): add WebXRHelper.cameras_origin_transform_enabled option to completely disable cameras origin transform, and review arrays used for XRView XRViewport and FrameCameraTransorm, add overriden_near_plane option for debug inside webxr emulator

## 0.1.6

### Patch Changes

-   refactor(livelink.webxr): correctly listen to webxr props changes
-   Updated dependencies
    -   @3dverse/livelink@0.8.38

## 0.1.5

### Patch Changes

-   fix(livelink.webxr): fix webxr component on react strict mode
-   fix(livelink.webxr): Revert partial fix of the cameras origin transform
-   Updated dependencies
    -   @3dverse/livelink@0.8.37

## 0.1.4

### Patch Changes

-   fix(livelink.webxr): partial fix of the cameras origin transform

## 0.1.3

### Patch Changes

-   fix(livelink-webxr): apply the orientation of the cameras origin to the transformed position of the camera
-   Updated dependencies
    -   @3dverse/livelink-react@0.2.47

## 0.1.2

### Patch Changes

-   fix(livelink.webxr): fixed ios webxr by forcing single view in variant launch clip app
-   feat(livelink.webxr): activate scale correction to reduce the billboard plane latency
-   Updated dependencies
    -   @3dverse/livelink@0.8.35

## 0.1.1

### Patch Changes

-   refactor(livelink.js): moved WebXR drawing context from livelink to new livelink-webxr package
-   feat(livelink.webxr): added options (features) to WebXR react component and force single view option to WebXRHelper for the iphone using Vairant Launch SDK
-   fix(livelink.xr): fixed scale factor to reduce plane latency
-   fix(livelink.webxr): removed resolution scale change when configuring scale factor as it's not needed and crashes on iphone
-   refactor(livelink.react): moved WebXR components from livelink-react to new livelink-webxr package
-   Updated dependencies
-   Updated dependencies
-   Updated dependencies
    -   @3dverse/livelink@0.8.33
    -   @3dverse/livelink-react@0.2.46
