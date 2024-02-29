import type { RTID, UUID } from "../../sources/types/common";
import type { Quat, Vec3 } from "../../sources/types/math";

/**
 *
 */
export type Euid = {
  value: UUID;
  rtid: RTID;
};

/**
 *
 */
export type Transform = Partial<{
  position: Vec3;
  orientation: Quat;
  scale: Vec3;
}>;

/**
 *
 */
export type DebugName = { value: string };

/**
 *
 */
export type AABB = { min: Vec3; max: Vec3 };

/**
 *
 */
export type Lineage = Partial<{
  ancestorRTID: string;
  value: string[];
  ordinal: number;
  parentUUID: string;
}>;

/**
 *
 */
export type SceneRef = { value: UUID };
export type MeshRef = { value: UUID };
export type MaterialRef = { value: UUID };
export type SkeletonRef = { value: UUID };

/**
 *
 */
export type AnimationController = {
  animationGraphRef: UUID;
  animationSetRef: UUID;
  /**
   * Check the editor for the spec.
   */
  dataJSON: {};
};

/**
 *
 */
export type ScriptMap = { elements: { [key: UUID]: ScriptElement } };
export type ScriptElement = {};

/**
 *
 */
export type BoxGeometry = {
  dimension: Vec3;
  offset: Vec3;
};
export type SphereGeometry = {
  radius: number;
  offset: Vec3;
};
export type CapsuleGeometry = {
  radius?: number;
  height?: number;
  axis?: number;
  offset?: Vec3;
};

/**
 *
 */
export type RigidBody = {
  mass: number;
  centerOfMass: Vec3;
  angularDamping: number;
  linearDamping: number;
  force: Vec3;
  torque: Vec3;
  isKinematic: boolean;
};

/**
 *
 */
export type Camera = {
  renderGraphRef: UUID;
  dataJSON: {};
};

export type PerspectiveLens = Partial<{
  aspectRatio: number;
  fov: number;
  nearPlane: number;
  farPlane: number;
}>;
