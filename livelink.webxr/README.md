# Livelink WebXR

Integrates the [Livelink](https://www.3dverse.com/) real-time 3D streaming SDK with the [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API) to deliver immersive VR and AR experiences. The package handles XR session management, stereo viewport configuration, latency compensation via billboard rendering, and a three-layer camera rig for physical + virtual movement composition.

**Live samples:**

- VR/AR (desktop & Android): https://samples.livelink.3dverse.com/#/web-xr
- AR (iOS via Variant Launch): https://samples.livelink.3dverse.com/#/web-xr-ios

---

## Architecture Overview

`XRLivelink` is the main facade. It orchestrates four internal managers:

| Manager        | Responsibility                                                |
| -------------- | ------------------------------------------------------------- |
| `LXRSession`   | XRSession lifecycle, reference space                          |
| `LXRSurface`   | WebGL layer, resolution scaling, overscan, display parameters |
| `LXRViewport`  | Per-eye viewport and camera entity setup                      |
| `LXRCameraRig` | Transform composition, virtual locomotion, billboard reversal |

In React applications the `<WebXR>` component wraps `XRLivelink` entirely. In vanilla TypeScript, `XRLivelink` is used directly.

---

## React — `<WebXR>`

Must be placed inside a `<Livelink>` context. Manages the full XR session lifecycle and exposes the `XRLivelink` instance via `ref`.

```tsx
import { Livelink } from "@3dverse/livelink-react";
import { WebXR } from "@3dverse/livelink-webxr/react";

<Livelink sceneId={sceneId} token={token}>
  <WebXR
    mode="immersive-vr"
    originTransform={{ position: [0, 2, 5], eulerOrientation: [0, 45, 0] }}
    latencyCompensation={true}
    overscan={false}
    scale={1.0}
    onSessionEnd={() => setXRMode(null)}
    ref={ref => setXrLivelink(ref?.livelinkXR ?? null)}
  >
    <WebXRVirtualJoysticks />
    {/* DOM overlay content */}
  </WebXR>
</Livelink>;
```

### Props

| Prop                         | Type                                               | Default       | Description                                                                                |
| ---------------------------- | -------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `mode`                       | `XRSessionMode`                                    | —             | `"immersive-vr"` or `"immersive-ar"`                                                       |
| `requiredFeatures`           | `string[]`                                         | `[]`          | XR session required features                                                               |
| `optionalFeatures`           | `string[]`                                         | `[]`          | XR session optional features (`"dom-overlay"` always added)                                |
| `forceSingleView`            | `boolean`                                          | —             | Forces mono rendering on stereo-capable devices                                            |
| `originTransform`            | `Partial<Transform>`                               | —             | Initial position/orientation/scale of the XR origin. Supports `eulerOrientation` (degrees) |
| `preserveInitialOrientation` | `boolean`                                          | `false`       | If `true`, preserves device pitch/roll at session start; default zeros them out            |
| `latencyCompensation`        | `boolean`                                          | `true`        | Enables billboard rendering to reduce perceived streaming latency                          |
| `overscan`                   | `boolean`                                          | `false`       | Increases FOV for billboard to hide edge artifacts during head movement                    |
| `fakeAlpha`                  | `boolean`                                          | `true` for AR | Simulates alpha blending with camera feed (AR sessions)                                    |
| `scale`                      | `number`                                           | `1.0`         | Resolution scale factor for the XR surface                                                 |
| `domOverlayRoot`             | `Element`                                          | —             | Custom DOM overlay root (required on iOS via Variant Launch)                               |
| `onSessionEnd`               | `(event: XRSessionEvent) => void`                  | —             | Callback when the XR session ends                                                          |
| `renderViewport`             | `(viewport: Viewport, index: number) => ReactNode` | —             | Custom render function for each eye viewport                                               |

The `ref` resolves to `{ livelinkXR: XRLivelink | undefined }` once the session is active.

---

## Vanilla TypeScript — `XRLivelink`

```typescript
import { XRLivelink } from "@3dverse/livelink-webxr";

// Check support before showing the Enter XR button
const supported = await XRLivelink.isSessionSupported("immersive-vr");

const xr = new XRLivelink(livelinkInstance);

const session = await xr.initialize({
  mode: "immersive-vr",
  xr_session_init: { requiredFeatures: ["local"] },
  origin_transform: { position: [0, 2, 5], eulerOrientation: [0, 45, 0] },
  preserve_initial_orientation: false,
});

session.addEventListener("end", () => xr.release());
xr.start(); // begins the XR animation frame loop
```

### Key `XRLivelink` properties

| Property                      | Type                      | Description                                        |
| ----------------------------- | ------------------------- | -------------------------------------------------- |
| `camera_rig`                  | `LXRCameraRig`            | Access virtual locomotion controls (see below)     |
| `xr_session`                  | `XRSession`               | Underlying XRSession                               |
| `xr_mode`                     | `XRSessionMode`           | Active session mode                                |
| `xr_reference_space`          | `XRReferenceSpace`        | Active reference space                             |
| `lxr_viewports`               | `Map<XREye, LXRViewport>` | Per-eye viewport configuration                     |
| `viewports`                   | `Viewport[]`              | Livelink viewport array                            |
| `is_stereo_vision`            | `boolean`                 | `true` when two viewports are configured           |
| `resolution_scale`            | `number`                  | XR surface resolution scale                        |
| `enable_latency_compensation` | `boolean`                 | Toggle billboard latency compensation              |
| `enable_overscan`             | `boolean`                 | Toggle overscan padding                            |
| `overscan_fov_factor`         | `number`                  | FOV multiplier when overscan is on (default `1.5`) |
| `enable_fake_alpha`           | `boolean`                 | Toggle AR fake alpha blending                      |
| `overriden_near_plane`        | `number \| undefined`     | Override near plane (useful for WebXR emulator)    |

---

## Virtual Locomotion — `LXRCameraRig`

`LXRCameraRig` is the central piece of the package. It is always accessed through `xrLivelink.camera_rig` — it is created and managed internally by `XRLivelink`.

All locomotion examples use `threejs-math` (a peer dependency):

```typescript
import { Vector3, Quaternion } from "threejs-math";
```

### Joystick Movement

Move relative to current head orientation:

```typescript
function applyJoystickMovement(rig: LXRCameraRig, joystickX: number, joystickY: number, speed = 0.02): void {
  if (Math.abs(joystickX) < 0.1 && Math.abs(joystickY) < 0.1) return;

  const poseOri = rig.pose_entity?.local_transform.orientation;
  if (!poseOri) return;

  const q = new Quaternion(...poseOri);
  const forward = new Vector3(0, 0, 1).applyQuaternion(q);
  const right = new Vector3(1, 0, 0).applyQuaternion(q);

  const move = new Vector3().addScaledVector(right, joystickX * speed).addScaledVector(forward, joystickY * speed);
  move.y = 0; // keep horizontal

  rig.incrementPoseLocalOffset({ position: [move.x, move.y, move.z] });
}
```

Built-in locomotion helpers are exported from the package: `LXRThrustMoveLocalSpace`, `LXRStrafeMoveLocalSpace`, `LXRThrustMoveWorldSpace`, `LXRStrafeMoveWorldSpace`, `LXRVerticalMoveLocalSpace`, `LXRVerticalMoveWorldSpace`. They handle the orientation math and call `incrementPoseLocalOffset` / `incrementWorldSpaceOffset` accordingly. The `<WebXRVirtualJoysticks>` React component uses them.

### Teleportation

```typescript
// Absolute position
rig.setPoseLocalOffset({ position: [10, 0, 5] });

// Forward teleport relative to current facing
function teleportForward(rig: LXRCameraRig, distance: number): void {
  const poseOri = rig.pose_entity?.local_transform.orientation;
  if (!poseOri) return;

  const forward = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...poseOri));
  const current = rig.pose_local_offset.position;
  rig.setPoseLocalOffset({
    position: [current.x + forward.x * distance, current.y, current.z + forward.z * distance],
  });
}
```

### Snap & Smooth Turning

Turning updates `pose_local_offset.orientation` — orbiting compensation is applied automatically:

```typescript
function snapTurn(rig: LXRCameraRig, direction: "left" | "right", angle = Math.PI / 4): void {
  const sign = direction === "left" ? 1 : -1;
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sign * angle);
  rig.incrementPoseLocalOffset({ orientation: rotation.toArray() });
}

function smoothTurn(rig: LXRCameraRig, direction: number, deltaTime: number, turnSpeed = Math.PI / 2): void {
  const angle = direction * turnSpeed * deltaTime;
  if (Math.abs(angle) < 0.001) return;
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle);
  rig.incrementPoseLocalOffset({ orientation: rotation.toArray() });
}
```

### Global Rotation (World-Space)

Rotate the entire virtual world around the user — useful for rotating the scene's forward direction at world scale:

```typescript
rig.setWorldSpaceOffset({
  orientation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)], // Y-axis rotation
});
```

### Scaling

`rig.scale` drives billboard compensation so camera positions are correctly reversed at any scale. Values above `1` make the user feel smaller; below `1`, larger:

```typescript
function setWorldScale(rig: LXRCameraRig, scale: number): void {
  rig.scale = Math.max(0.1, Math.min(10, scale));
}
```

`LXRScaling.ts` exports helpers `nextScaleUp()` / `nextScaleDown()` for coarse-logarithmic stepping, and `applyScale()` which optionally compensates anchor position (VR) or leaves it fixed (AR).

### Adjust Floor Height

```typescript
function setFloorHeight(rig: LXRCameraRig, floorY: number): void {
  if (!rig.anchor_entity) return;
  const current = rig.anchor_entity.local_transform;
  rig.anchor_entity.local_transform = {
    position: [current.position[0], floorY, current.position[2]],
    orientation: current.orientation,
    scale: current.scale,
  };
}
```

### Reset & Recenter

```typescript
// Clear all virtual movement
function recenter(rig: LXRCameraRig): void {
  rig.resetPoseLocalOffset();
  rig.resetWorldSpaceOffset();
}

// Respawn at a specific world position
function respawnAt(rig: LXRCameraRig, position: [number, number, number]): void {
  if (rig.anchor_entity) {
    rig.anchor_entity.local_transform = { position, orientation: [0, 0, 0, 1] };
  }
  recenter(rig);
}
```

### Direct Mutation vs Setters

`world_space_offset` and `pose_local_offset` return mutable objects. Before directly mutating an **orientation**, call the corresponding flag method to trigger compensation. Position can be mutated freely:

```typescript
// World-space orientation: direct mutation — requires flag
rig.markWorldSpaceOffsetOrientationChanged();
rig.world_space_offset.orientation.multiply(deltaQuat);

// World-space: setter — flag called internally
rig.setWorldSpaceOffset({ orientation: [0, 0.707, 0, 0.707] });
rig.incrementWorldSpaceOffset({ orientation: deltaQuat.toArray() });

// Pose-local orientation: direct mutation — requires flag
rig.markPoseLocalOffsetOrientationChanged();
rig.pose_local_offset.orientation.multiply(deltaQuat);

// Pose-local: setter — flag called internally
rig.setPoseLocalOffset({ orientation: [0, 0.707, 0, 0.707] });
rig.incrementPoseLocalOffset({ orientation: deltaQuat.toArray() });
```

All setters also accept `eulerOrientation: [x, y, z]` (degrees) as an alternative to `orientation`.

---

## Architecture

### Entity Hierarchy

```
xr_rig_origin          (world anchor — anchor_entity)
  └─ xr_rig_pose       (updated per frame — pose_entity)
       ├─ camera_left   (static IPD offset, child of pose_entity)
       └─ camera_right  (static IPD offset, child of pose_entity)
```

- **`anchor_entity`**: World anchor; repositioning it moves the entire rig. Typically set once via `originTransform`.
- **`pose_entity`**: Receives fully composed transforms per frame. **Do not** set its `local_transform` manually — it is overwritten on every XR frame.
- **Camera entities**: Created by `LXRViewport` and parented to `pose_entity` during `XRLivelink.initialize()`.

### Transform Layers

Three independent layers compose into `pose_entity.local_transform` each frame:

| Layer                     | Space       | Purpose                                 | API                                                    |
| ------------------------- | ----------- | --------------------------------------- | ------------------------------------------------------ |
| **Tracking**              | room-space  | Physical XR device movement             | Read-only (hardware)                                   |
| **Pose-local offset**     | pose-local  | Virtual locomotion (joystick, teleport) | `setPoseLocalOffset()`, `incrementPoseLocalOffset()`   |
| **World-space transform** | world-space | Global rig rotation/position            | `setWorldSpaceOffset()`, `incrementWorldSpaceOffset()` |

**Composition formula** (all values in origin-local space; world-space inputs auto-converted):

```
position    = ws_ori * (ls_ori * tracking + ls_comp) + ws_comp + ls_pos + ws_pos
orientation = ws_ori * ls_ori * tracking_ori
```

**Composition order** (executed each frame inside `#updatePoseTransform`):

1. Start with XR device tracking pose (room-space)
2. Normalize tracking relative to the initial pose captured at init (when `originTransform` is provided)
3. Rotate tracking position by pose-local offset orientation — physical movement follows virtual turn direction
4. Accumulate pose-local compensation if orientation changed (prevents orbiting)
5. Rotate by world-space orientation in anchor-local frame
6. Accumulate world-space compensation if orientation changed (prevents orbiting)
7. Add pose-local offset position and world-space position

### Compensation

When either `pose_local_offset.orientation` or `world_space_offset.orientation` changes, the current tracking position would arc around the origin ("orbiting"). The rig computes a one-time correction so the user stays visually in place:

```
// Pose-local (applied before world-space rotation)
ls_comp += Q_ls_old * tracking_pos − Q_ls_new * tracking_pos

// World-space (applied after world-space rotation)
ws_comp += Q_ws_old * (ls_ori * tracking_pos + ls_comp)
         − Q_ws_new * (ls_ori * tracking_pos + ls_comp)
```

Each compensation vector accumulates over successive orientation changes and is reset by `resetPoseLocalOffset()` / `resetWorldSpaceOffset()`.

### Billboard Reversal

`update({ remote_camera_transforms })` composes the pose transform and then strips all rig layers from the world-space camera transforms to recover raw XR device poses for billboard placement. All steps run per-camera per-frame:

**Position reversal:**

1. Undo rig scale (`× scale`)
2. Apply `inv(anchor)` matrix (world → anchor-local)
3. Subtract additive offsets: `ws_pos`, `ws_comp`, `ls_pos`
4. Apply `inv(ws_ori)` rotation
5. Subtract `ls_comp`
6. Apply `inv(ls_ori)` rotation
7. Restore tracking normalization: `inv(init_ori) * pos + init_pos` (only when `originTransform` was provided)

**Orientation reversal:** left-multiply `inv(anchor_ori)` → `inv(ws_ori)` → `inv(ls_ori)` → `inv(init_tracking_ori)` (if present)

**Critical:** Additive offsets (step 3) must be subtracted **before** rotation reversal (step 4) because they are added _after_ rotation in forward composition.

`remote_camera_transforms` is modified **in place** — consume values only after `update()` returns.

---

## Design Principles

1. **Separation of Concerns**: Three independent layers (tracking, pose-local, world-space)
2. **Dual Compensation**: Both pose-local and world-space orientation changes compensated automatically
3. **Explicit Reversibility**: All transforms composable and reversed inside `update()` for billboard-ready camera poses
4. **Explicit Signaling**: `markWorldSpaceOffsetOrientationChanged()` / `markPoseLocalOffsetOrientationChanged()` required before direct orientation mutation
5. **Performance**: Compensation computed once per change; pre-allocated scratch vectors avoid per-frame GC pressure
6. **Flexibility**: Direct entity access via `anchor_entity` and `pose_entity` for advanced use cases
