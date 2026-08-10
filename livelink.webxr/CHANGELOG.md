# @3dverse/livelink-webxr

## 0.2.6

### Patch Changes

- feat(livelink.webxr): allow xr viewport live change and secure xr loop if it throws
- feat(livelink.webxr): allow earlier session-end event subscribe, add onError callback if init error, remove unintended fakeAlpha dependency from react layout effect
- feat(livelink.webxr): improve LXRContext texture magnification quality, do not resolve shader program uniforms on each draw call, fix gl resource leak, adapt screen distance to rig scale
- fix(livelink.webxr): LXRContext's fragment shader premultiplied RGB by the pre-scale luminance alpha instead of the final one, so lowering alpha made the image brighter rather than translucent.
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.65
  - @3dverse/livelink-react-ui@0.3.24

## 0.2.5

### Patch Changes

- chore: update dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink-react-ui@0.3.22
  - @3dverse/livelink@0.8.63
  - @3dverse/livelink-react@0.2.64

## 0.2.4

### Patch Changes

- fix(livelink.webxr): enable tracking compensation by default if origin_transform specified at init

## 0.2.3

### Patch Changes

- feat(livelink.webxr): expose flag to allow to toggle init tracking pose compensation manually

## 0.2.2

### Patch Changes

- docs(livelink.webxr): LXRContext doc
- feat(livelink.webxr): expose fake_alpha_scale get/set

## 0.2.1

### Patch Changes

- feat(livelink.webxr): upgrade minor version
- fix(livelink.webxr): fixed css position for default dom overlay root so virtual viewports fit the webgl canvas which has full screen size
- docs(livelink.webxr): README and fixed tsconfig
- feat(livelink.webxr): add LXRScaling feature, review LXRLocomotion interface, more flexible config for WebXRVirtualJoysticks
- feat(livelink.webxr): review camera rig center eye update
- Updated dependencies
  - @3dverse/livelink-react-ui@0.3.21

## 0.1.19

### Patch Changes

- feat(livelink.webxr): rig scaling feature, review locomotion api, naming & doc review
- fix(livelink.samples): x-web-xr-ios dom overlay and add performance panel to xr samples
- feat(livelink.webxr): full revamp of livelink.webxr implementation, new features:
- feat(livelink.webxr): use scratch math objects to reduce per frame allocation in LXRCameraRig.update
- Updated dependencies
  - @3dverse/livelink@0.8.62

## 0.1.18

### Patch Changes

- feat(livelink-webxr): add xr dom overlay feature, expose viewports in WebXRContext, export XRContext

## 0.1.17

### Patch Changes

- feat(livelink.webxr): expose parameter to enable or disable and configure latency compensation, even at runtime
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.56
  - @3dverse/livelink-react@0.2.59

## 0.1.16

### Patch Changes

- chore: update dependencies
- feat(livelink.webxr): add scale option to WebXR component
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.55
  - @3dverse/livelink-react@0.2.58

## 0.1.15

### Patch Changes

- fix(livelink.webxr): release viewports and cameras
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.54
  - @3dverse/livelink-react@0.2.57

## 0.1.14

### Patch Changes

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
  - @3dverse/livelink-react@0.2.54
  - @3dverse/livelink@0.8.51

## 0.1.13

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
  - @3dverse/livelink-react@0.2.53

## 0.1.12

### Patch Changes

- chore: update dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink-react@0.2.52
  - @3dverse/livelink@0.8.48

## 0.1.11

### Patch Changes

- fix(livelink.samples): x-web-wr-ios, overscan and resolution scale fails on variant launch app clip, and also fix the dom-overlay
- feat(livelink.webxr): enable gl alpha blend function to be able to adjust fakeAlpha

## 0.1.10

### Patch Changes

- feat(livelink.webxr): re-enable surface scale for overscan, and expose fov factor and the surface scale activation of the overscan from WebXR react component

## 0.1.9

### Patch Changes

- chore: removed useless package-lock
- fix(livelink.webxr): reset xr session state when it's released
- chore: update dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.44
  - @3dverse/livelink-react@0.2.50

## 0.1.8

### Patch Changes

- chore: updated all packages and fixed build
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.40
  - @3dverse/livelink-react@0.2.48

## 0.1.7

### Patch Changes

- feat(livelink.webxr): better alpha blend in XRContext fragment shader for immersive-ar sessions, and optional alpha scale to see through opaque surface while using immersive-ar
- feat(livelink.webxr): add WebXRHelper.cameras_origin_transform_enabled option to completely disable cameras origin transform, and review arrays used for XRView XRViewport and FrameCameraTransorm, add overriden_near_plane option for debug inside webxr emulator

## 0.1.6

### Patch Changes

- refactor(livelink.webxr): correctly listen to webxr props changes
- Updated dependencies
  - @3dverse/livelink@0.8.38

## 0.1.5

### Patch Changes

- fix(livelink.webxr): fix webxr component on react strict mode
- fix(livelink.webxr): Revert partial fix of the cameras origin transform
- Updated dependencies
  - @3dverse/livelink@0.8.37

## 0.1.4

### Patch Changes

- fix(livelink.webxr): partial fix of the cameras origin transform

## 0.1.3

### Patch Changes

- fix(livelink-webxr): apply the orientation of the cameras origin to the transformed position of the camera
- Updated dependencies
  - @3dverse/livelink-react@0.2.47

## 0.1.2

### Patch Changes

- fix(livelink.webxr): fixed ios webxr by forcing single view in variant launch clip app
- feat(livelink.webxr): activate scale correction to reduce the billboard plane latency
- Updated dependencies
  - @3dverse/livelink@0.8.35

## 0.1.1

### Patch Changes

- refactor(livelink.js): moved WebXR drawing context from livelink to new livelink-webxr package
- feat(livelink.webxr): added options (features) to WebXR react component and force single view option to WebXRHelper for the iphone using Vairant Launch SDK
- fix(livelink.xr): fixed scale factor to reduce plane latency
- fix(livelink.webxr): removed resolution scale change when configuring scale factor as it's not needed and crashes on iphone
- refactor(livelink.react): moved WebXR components from livelink-react to new livelink-webxr package
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @3dverse/livelink@0.8.33
  - @3dverse/livelink-react@0.2.46
