# @3dverse/livelink-webxr

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
