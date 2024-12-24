import { Quat, UUID, Vec2, Vec3, Vec4 } from "@3dverse/livelink.core";

/**
 * A complete and unique reference to an entity.
 *
 * @category Scene
 */
export type EntityRef = {
    /**
     * The UUID of the entity.
     * This is only unique within the scene the entity is created in.
     * If a scene is instantiated multiple times, the same entity will be instantiated multiple times with the same UUID.
     */
    originalEUID: UUID;

    /**
     * The UUIDs of the chain of linkers that brought the entity to the current scene.
     * This is what allows the entity to be uniquely identified across multiple instances of the same scene.
     */
    linkage?: Array<UUID>;
};

/**
 * The data object to use in the `dataJSON` property of the {@link Components.Camera} component.
 *
 * @category Scene
 */
export type RenderGraphDataObject = Record<string, Vec4 | Vec3 | Vec2 | number | boolean>;

/**
 * The data object to use in the `dataJSON` property of the {@link Components.ScriptElement} component.
 *
 * @category Scene
 */
export type ScriptDataObject = Record<string, Quat | Vec4 | Vec3 | Vec2 | number | boolean | string | EntityRef>;

/**
 * The data object to use in the `dataJSON` property of the {@link Components.Material} component.
 *
 * @category Scene
 */
export type ShaderDataObject = Record<string, Vec4 | Vec3 | Vec2 | number | boolean | UUID>;

/**
 * The data object to use in the `dataJSON` property of the {@link Components.AnimationController} component.
 *
 * @category Scene
 */
export type AnimationGraphDataObject = Record<string, Vec3 | number | boolean | UUID>;
