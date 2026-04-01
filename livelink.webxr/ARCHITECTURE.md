# Livelink WebXR - LXRCameraRig Architecture

## Overview

`LXRCameraRig` manages XR camera hierarchy with three-layer transform composition: tracking (XR device), pose-local offset (virtual movement), and world-space transform (global positioning). Prevents "orbiting" artifacts via automatic compensation.

## Entity Hierarchy

```
xr_rig_origin          (world anchor, set at init)
  └─ xr_rig_pose       (updated per frame)
       ├─ camera_left   (static IPD offset)
       └─ camera_right  (static IPD offset)
```

- **anchor_entity**: World anchor, typically unchanged after init
- **pose_entity**: Receives composed transforms every frame
- **camera_entities**: Eye cameras as children of pose

## Transform Layers

Three independent layers compose into `pose_entity.local_transform` each frame:

| Layer                     | Space       | Purpose                                 | Control                                                |
| ------------------------- | ----------- | --------------------------------------- | ------------------------------------------------------ |
| **Tracking**              | room-space  | Physical XR movement                    | Read-only (hardware)                                   |
| **Pose-local offset**     | pose-local  | Virtual locomotion (joystick, teleport) | `setPoseLocalOffset()`, `incrementPoseLocalOffset()`   |
| **World-space transform** | world-space | Global rig rotation/position            | `setWorldSpaceOffset()`, `incrementWorldSpaceOffset()` |

**Composition:**

```
position = ws_ori * (ls_ori * tracking + ls_comp) + ws_comp + ls_pos + ws_pos
orientation = ws_ori * ls_ori * tracking_ori
```

(All in origin-local space; world-space values auto-converted)

## Compensation

Both **world-space** and **pose-local offset** orientation changes trigger compensation. When either orientation changes, `tracking_pos` would rotate around the origin ("orbiting"). Compensation cancels this:

```
// Pose-local offset compensation (applied before ws rotation)
ls_comp += Q_ls_old * tracking_pos − Q_ls_new * tracking_pos

// World-space compensation (applied after ws rotation)
ws_comp += Q_ws_old * (ls_ori * tracking_pos + ls_comp) − Q_ws_new * (ls_ori * tracking_pos + ls_comp)
```

Each is applied once per orientation change, keeping the user in place.

## Billboard Reversal

Internal rig stripping extracts raw XR pose by reversing layers during `update()`:

1. `inv(origin)` matrix
2. Subtract additive offsets (`ws_pos`, `ws_comp`, `ls_pos`)
3. `inv(ws_ori)` rotation
4. Subtract `ls_comp`
5. `inv(ls_ori)` rotation
6. Restore tracking-origin normalization
7. `inv(anchor_ori)`, `inv(ws_ori)`, `inv(ls_ori)`, `inv(init_tracking_ori)` quaternion chain

**Critical:** Additive offsets (2) before rotation reversal (3) — they're added after rotation in composition.

## API Quick Reference

### Basic Initialization

```typescript
const rig = new LXRCameraRig(scene);

// Initialize with XR views
await rig.initialize({
  xr_views: xrFrame.views,
  origin_transform: {
    position: [0, 0, 0],
    orientation: [0, 0, 0, 1],
    scale: [1, 1, 1]
  }
});

// Add camera entities
const cameraLeft = /* create entity */;
const cameraRight = /* create entity */;
await rig.attachCamera(cameraLeft);
await rig.attachCamera(cameraRight);
```

### Virtual Joystick Movement

```typescript
// Each frame with joystick input
const speed = 0.01; // Small increments
rig.incrementPoseLocalOffset({
  position: [joystickX * speed, 0, joystickY * speed],
});
```

### Teleportation

```typescript
rig.setPoseLocalOffset({
  position: targetPosition,
});
```

### Rotating Field of View

```typescript
rig.setWorldSpaceOffset({
  orientation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)], // Y-axis rotation
});
```

### Direct Orientation Change

```typescript
// When you need frame-by-frame orientation mutation
rig.markWorldSpaceOffsetOrientationChanged();
const quat = rig.world_space_offset.orientation;
quat.y += rotationDelta; // Rotate around Y
```

### Scaling the World

```typescript
// Make user feel 2x larger by scaling world 0.5x
rig.anchor_entity.local_transform = { scale: [0.5, 0.5, 0.5] };
```

## Direct Mutation vs Setters

Both `world_space_offset` and `pose_local_offset` getters return mutable objects. Before directly mutating either orientation, call the corresponding flag method to trigger compensation:

```typescript
// World-space: direct mutation - requires flag
rig.markWorldSpaceOffsetOrientationChanged();
rig.world_space_offset.orientation.y = 0.707;

// World-space: setter - flag called internally
rig.setWorldSpaceOffset({ orientation: [0, 0.707, 0, 0.707] });

// Pose-local: direct mutation - requires flag
rig.markPoseLocalOffsetOrientationChanged();
rig.pose_local_offset.orientation.multiply(deltaQuat);

// Pose-local: setter - flag called internally
rig.incrementPoseLocalOffset({ orientation: deltaQuat.toArray() });
```

Not needed when using setters (`setPoseLocalOffset()`, `incrementPoseLocalOffset()`, `setWorldSpaceOffset()`, `incrementWorldSpaceOffset()`) — they call the flag internally. Positions can be mutated directly without flags.

## Billboard Placement (Advanced)

Raw XR device pose extraction happens internally during `update()`.

```typescript
rig.update({
  center_eye,
  remote_camera_transforms: cameraPoses,
});
```

`cameraPoses` is modified in place by the internal strip pass, so consumers should only use the public `update()` API.

Internal reversal order: `inv(origin)` → subtract additive offsets → `inv(ws_ori)` → subtract `ls_comp` → `inv(ls_ori)` → restore tracking-origin.

**Key:** Additive offsets are subtracted BEFORE rotation reversal because they're added AFTER rotation in composition.

## Key Implementation Details

### Transform Composition Order

1. Start with XR device tracking pose (room-space)
2. Rotate tracking position by pose-local offset orientation (physical movement follows virtual turn)
3. Apply pose-local compensation (prevents orbiting when joystick-turning away from room origin)
4. Rotate by world-space orientation in origin-local frame
5. Apply world-space compensation (prevents orbiting on global rotation)
6. Add pose-local offset position
7. Add world-space position

## Design Principles

1. **Separation of Concerns**: Three independent layers (tracking, pose-local, world-space)
2. **Dual Compensation**: Both pose-local and world-space orientation changes compensated automatically
3. **Explicit Reversibility**: All transforms are composable and reversed internally in `update()` for billboard-ready camera poses
4. **Explicit Signaling**: `markWorldSpaceOffsetOrientationChanged()` for direct mutation clarity
5. **Performance**: Compensation computed once per change; caches origin-local transforms
6. **Flexibility**: Direct entity access for advanced use cases
