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
  fovy: number;
  nearPlane: number;
  farPlane: number;
}>;

export enum ComponentHash {
  AnimationController = 2978761622,
  Bone = 1352454807,
  BoxGeometry = 3718707752,
  Camera = 1515175333,
  CapsuleGeometry = 3996568839,
  CharacterController = 304568171,
  CollisionGeometry = 3193374355,
  CullingGeometry = 611599156,
  CylinderGeometry = 2497701877,
  DebugName = 2737255849,
  DecalProjector = 2842087135,
  Environment = 227427331,
  Joint = 2286235554,
  Lineage = 2698448560,
  LocalAABB = 4132624459,
  local_transform = 64958624,
  MaterialRef = 2816861126,
  Material = 4100970527,
  MeshRef = 1660697531,
  OrthographicLens = 3326403741,
  PerspectiveLens = 1113360699,
  PhysicsMaterial = 1550394949,
  PlaneGeometry = 4075752378,
  PointCloudRef = 457361603,
  PointLight = 3624222817,
  ReflectionProbe = 3879689944,
  RevoluteJoint = 1364947094,
  RigibBody = 3452128059,
  SceneRef = 371342060,
  ScriptMap = 3291722836,
  ShadowCaster = 3403528636,
  SkeletonRef = 36879215,
  SoundRef = 369352309,
  SphereGeometry = 1159992935,
  SpotLight = 1508811228,
  Tags = 163258925,
  VolumeFilter = 2625356468,
  VolumetMaterialRef = 3229245461,
  VolumeRef = 2808449574,
}
