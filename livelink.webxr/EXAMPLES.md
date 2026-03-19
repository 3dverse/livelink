# LXRCameraRig Examples

> For architecture, transform layers, and API reference, see [ARCHITECTURE.md](./ARCHITECTURE.md).

All examples use `threejs-math` (already a peer dependency of `@3dverse/livelink-webxr`).

```typescript
import { Vector3, Quaternion } from "threejs-math";
import { LXRCameraRig } from "@3dverse/livelink-webxr";
```

## Joystick Movement

Move relative to current head orientation.

```typescript
function applyJoystickMovement(rig: LXRCameraRig, joystickX: number, joystickY: number, speed = 0.02): void {
  if (Math.abs(joystickX) < 0.1 && Math.abs(joystickY) < 0.1) return;

  const poseOri = rig.pose_entity?.local_transform.orientation;
  if (!poseOri) return;

  const q = new Quaternion(...poseOri);
  const forward = new Vector3(0, 0, 1).applyQuaternion(q);
  const right = new Vector3(1, 0, 0).applyQuaternion(q);

  const move = new Vector3().addScaledVector(right, joystickX * speed).addScaledVector(forward, joystickY * speed);
  move.y = 0; // Keep horizontal

  rig.incrementPoseLocalOffset({ position: [move.x, move.y, move.z] });
}
```

## Teleportation

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

## Snap & Smooth Turning

Turning uses `pose_ls_offset.orientation` — compensation is handled automatically.

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

## Scaling & Height

```typescript
// Scale world (> 1 = user feels smaller, < 1 = user feels larger)
function setWorldScale(rig: LXRCameraRig, scale: number): void {
  scale = Math.max(0.1, Math.min(10, scale));
  if (rig.anchor_entity) {
    rig.anchor_entity.local_transform = { scale: [scale, scale, scale] };
  }
}

// Adjust floor height (seated vs standing)
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

## Reset & Recenter

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
