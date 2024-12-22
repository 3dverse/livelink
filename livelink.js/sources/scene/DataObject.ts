import { Quat, UUID, Vec2, Vec3, Vec4 } from "@3dverse/livelink.core";

/**
 * @category Scene
 */
export type RenderGraphDataObject = Record<string, Vec4 | Vec3 | Vec2 | number | boolean>;

/**
 * @internal
 */
export type EntityRef = { linkage: Array<UUID>; originalEUID: UUID };

/**
 * @category Scene
 */
export type ScriptDataObject = Record<string, Quat | Vec4 | Vec3 | Vec2 | number | boolean | string | EntityRef>;

/**
 * @category Scene
 */
export type AnimationSequenceDataObject = Record<string, Quat | Vec4 | Vec3 | Vec2 | number | boolean | UUID | string>;

/**
 * @category Scene
 */
export type ShaderDataObject = Record<string, Vec4 | Vec3 | Vec2 | number | boolean | UUID>;

/**
 * @category Scene
 */
export type AnimationGraphDataObject = Record<string, Vec3 | number | boolean | UUID>;
