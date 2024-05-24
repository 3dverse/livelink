import type { RTID, UUID, Quat, Vec3 } from "../../sources/types";

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

export type OrthographicLens = Partial<{
  left: number;
  right: number;
  top: number;
  bottom: number;
  zNear: number;
  zFar: number;
}>;

export enum ComponentHash {
  animation_controller = 2978761622,
  bone = 1352454807,
  box_geometry = 3718707752,
  camera = 1515175333,
  capsule_geometry = 3996568839,
  character_gontroller = 304568171,
  collision_geometry = 3193374355,
  culling_geometry = 611599156,
  cylinder_geometry = 2497701877,
  debugName = 2737255849,
  decal_projector = 2842087135,
  environment = 227427331,
  joint = 2286235554,
  lineage = 2698448560,
  local_aabb = 4132624459,
  local_transform = 64958624,
  material_ref = 2816861126,
  material = 4100970527,
  mesh_Ref = 1660697531,
  orthographic_lens = 3326403741,
  perspective_lens = 1113360699,
  physics_material = 1550394949,
  plane_geometry = 4075752378,
  point_cloud_ref = 457361603,
  point_light = 3624222817,
  reflection_probe = 3879689944,
  revolute_joint = 1364947094,
  rigib_body = 3452128059,
  scene_ref = 371342060,
  script_map = 3291722836,
  shadow_caster = 3403528636,
  skeleton_ref = 36879215,
  sound_ref = 369352309,
  sphere_geometry = 1159992935,
  spot_light = 1508811228,
  tags = 163258925,
  volume_filter = 2625356468,
  volumet_material_ref = 3229245461,
  volume_ref = 2808449574,
}
