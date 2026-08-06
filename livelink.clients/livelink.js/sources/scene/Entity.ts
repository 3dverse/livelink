//------------------------------------------------------------------------------
import type {
    ComponentName,
    ComponentType,
    Components,
    EntityCore,
    Mat4,
    Quat,
    RTID,
    Vec3,
} from "@3dverse/livelink.core";
import { Client } from "@livelink.base/session/Client";
import { Entity as EntityBase } from "@livelink.base/scene/Entity";
import { EntityUpdatedEvent } from "@livelink.base/scene/EntityEvents";
import type { EntityCreationOptions, SceneEntityInterface } from "@livelink.base/scene/Scene";
import type { DefaultValue } from "@livelink.base/_prebuild/EntityComponents";
import { mat4, quat, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import { EntityComponentsProxy } from "../../_prebuild/EntityComponentsProxy";

//------------------------------------------------------------------------------
import { quaternionFromEuler, quaternionToEuler } from "@livelink.base/maths";

function assert<_T extends never>(): void {}
type TypeSatisfies<A, B> = Exclude<B, A>;

/**
 * @category Engine Schemas
 */
export type Transform = {
    /**
     * x, y, z position of the entity.
     * @defaultValue 0,0,0
     */
    position: Vec3;

    /**
     * Orientation of the entity expressed as a quaternion.
     * @defaultValue 0,0,0,1
     */
    orientation: Quat;

    /**
     * x, y, z scale of the entity.
     * @defaultValue 1,1,1
     */
    scale: Vec3;

    /**
     * Orientation of the entity expressed as euler angles.
     * @defaultValue 0,0,0
     */
    eulerOrientation: Vec3;
};

/**
 * Axis-Aligned Bounding Box data
 *
 * @category Engine Schemas
 */
export type Aabb = {
    /**
     * Minimum X,Y,Z distances
     * @defaultValue -1,-1,-1
     */
    min: Vec3;
    /**
     * Maximum X,Y,Z distances
     * @defaultValue 1,1,1
     */
    max: Vec3;
    /**
     * Center of the bounding box
     * @defaultValue 0,0,0
     */
    center: Vec3;
    /**
     * longest edge length of the bounding box
     * @defaultValue 2
     */
    longest_edge_length: number;
};

assert<TypeSatisfies<Transform, Omit<Components.LocalTransform, "globalEulerOrientation">>>();

/**
 * An entity in a scene.
 *
 * The browser entity is the shared the shared core {@link Entity} plus transform handling.
 * It specializes the scene/parent/children types to the browser flavour; all component storage, dirty tracking,
 * scripts and visibility come from the shared base.
 *
 * Components are read through getters returning the live, mutable value and flagged explicitly with
 * `updateComponent()` / `updateComponents()`. The `local_transform` / `global_transform` setters are
 * transform-aware and flag the entity for you.
 *
 * It adds local/global transform handling on top of the browser {@link EntityComponentsProxy}.
 *
 * The `local_transform` component lives in the shared storage core; this layer exposes proxied
 * `local_transform` / `global_transform` views so that mutating a sub-property
 * (`entity.local_transform.position[0] = 5`) recomputes and flags the entity, and derives & caches
 * the global transform and the local/world matrices lazily on read.
 *
 * This class cannot be instantiated directly.
 * Use the {@link Scene.newEntity} or {@link Scene.newEntities} methods on an existing scene to
 * create an entity.
 *
 * @category Scene
 */
export class Entity extends EntityComponentsProxy {
    /**
     * Cached global transform, recomputed lazily from the local transform and the parent chain.
     */
    #global_transform: Transform;

    /**
     * Proxy view over the global transform, lazily created on first access.
     */
    #global_transform_proxy: GlobalTransformHandler;

    /**
     *
     */
    #local_transform: Components.LocalTransform;

    /**
     * Proxy view over the local transform, lazily created on first access.
     */
    #local_transform_proxy: LocalTransformHandler;

    /**
     * The local space to world space matrix of the entity.
     */
    #ls_to_ws: Mat4 = mat4.create() as Mat4;

    /**
     * The world space to local space matrix of the entity.
     */
    #ws_to_ls: Mat4 = mat4.create() as Mat4;

    /**
     * Whether the global transform needs to be recalculated.
     */
    #is_global_transform_dirty = true;

    /**
     * A counter that increments every time the global or local transform of the entity is altered.
     * Used by our child entities to determine if their parent entity has been altered since the last update.
     * See #last_parent_update_id below.
     */
    #last_update_id = 0;

    /**
     * A copy of the last parent entity update id.
     * Used to determine if our parent entity has been altered since the last update.
     */
    #last_parent_update_id = 0;

    /**
     * @internal
     */
    constructor({
        scene,
        parent = null,
        components,
        options,
        is_visible = true,
        children_rtid = [],
    }: {
        scene: SceneEntityInterface;
        parent: Entity | null;
        components: EntityCore;
        options?: EntityCreationOptions;
        is_visible?: boolean;
        children_rtid?: Array<RTID>;
    }) {
        super({
            scene,
            parent,
            components,
            options,
            is_visible,
            children_rtid,
        });

        // The transform layer always needs a local_transform to work with. Reuse the value the
        // base constructor sanitized and stored; sanitize a default one only when the entity came
        // without it. #local_transform aliases the stored component — the transform proxies and
        // the base merge/re-sync paths rely on that shared identity.
        const stored_local_transform = this._unsafeGetComponentValue({ component_name: "local_transform" });
        if (stored_local_transform !== undefined) {
            this.#local_transform = stored_local_transform;
        } else {
            this.#local_transform = scene._sanitizeComponentValue({
                component_name: "local_transform",
                value: undefined,
            });
            this._unsafeSetComponentValue({ component_name: "local_transform", value: this.#local_transform });
            this._refreshLocalTransformShadow();
        }

        this.#global_transform = {
            position: [0, 0, 0],
            orientation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            eulerOrientation: [0, 0, 0],
        };

        this.#local_transform_proxy = new LocalTransformHandler(this, this.#local_transform);
        this.#global_transform_proxy = new GlobalTransformHandler(this, this.#global_transform);
    }

    /**
     * @internal
     */
    get _last_update_id(): number {
        return this.#last_update_id;
    }

    /**
     * The global transform of the entity.
     */
    get global_transform(): Transform {
        return this.#global_transform_proxy;
    }

    /**
     * The global transform of the entity.
     */
    set global_transform(value: Partial<Transform>) {
        this._setGlobalTransform({ global_transform: value, emitter: null });
        this._markComponentAsDirty({ component_name: "local_transform", is_new: false });
    }

    /**
     * The local transform of the entity.
     */
    get local_transform(): Transform {
        return this.#local_transform_proxy;
    }

    /**
     * The local transform of the entity.
     */
    set local_transform(value: Partial<Transform>) {
        Object.assign(this.local_transform, value);
    }

    /**
     * The global bounding box (aabb) of the entity.
     */
    get global_aabb(): Aabb {
        let longest_edge_length = -Number.MAX_VALUE;
        const local_aabb = this.local_aabb || { min: [-1, -1, -1] as Vec3, max: [1, 1, 1] as Vec3 };
        const { min: aabb_min, max: aabb_max } = local_aabb;

        const vertices = [
            vec3.fromValues(aabb_min[0], aabb_min[1], aabb_min[2]),
            vec3.fromValues(aabb_max[0], aabb_min[1], aabb_min[2]),
            vec3.fromValues(aabb_min[0], aabb_max[1], aabb_min[2]),
            vec3.fromValues(aabb_min[0], aabb_min[1], aabb_max[2]),
            vec3.fromValues(aabb_max[0], aabb_max[1], aabb_max[2]),
            vec3.fromValues(aabb_min[0], aabb_max[1], aabb_max[2]),
            vec3.fromValues(aabb_max[0], aabb_min[1], aabb_max[2]),
            vec3.fromValues(aabb_max[0], aabb_max[1], aabb_min[2]),
        ];

        vertices.forEach(vertex => vec3.transformMat4(vertex, vertex, this.ls_to_ws as mat4));

        const min = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        const max = vec3.fromValues(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        const center = vec3.create();
        vertices.forEach(vertex => {
            vec3.min(min, min, vertex);
            vec3.max(max, max, vertex);
            vec3.add(center, center, vertex);
        });
        vec3.scale(center, center, 1 / 8);

        const axes = [
            { vertex: vertices[0], test_vertices: [vertices[1], vertices[2], vertices[3]] },
            { vertex: vertices[6], test_vertices: [vertices[1], vertices[3], vertices[4]] },
            { vertex: vertices[5], test_vertices: [vertices[2], vertices[3], vertices[4]] },
            { vertex: vertices[7], test_vertices: [vertices[1], vertices[2], vertices[4]] },
        ];

        axes.forEach(({ vertex, test_vertices }) => {
            test_vertices.forEach(test_vertex => {
                const distance = vec3.distance(vertex, test_vertex);
                if (distance > longest_edge_length) {
                    longest_edge_length = distance;
                }
            });
        });

        return {
            min: Array.from(min) as Vec3,
            max: Array.from(max) as Vec3,
            center: Array.from(center) as Vec3,
            longest_edge_length,
        };
    }

    /**
     * The parent entity of this entity or null if it has no parent.
     */
    override get parent(): Entity | null {
        return super.parent as Entity | null;
    }

    /**
     * Re-parent the entity by setting a parent entity.
     */
    override set parent(parent: Entity | null) {
        super.parent = parent;
        this.#is_global_transform_dirty = true;
    }

    /**
     * Check if the entity global transform, or any of its ancestors global transform,
     * has been modified since the last calculation.
     */
    get #is_dirty(): boolean {
        if (this.parent) {
            if (this.parent._last_update_id !== this.#last_parent_update_id) {
                return true;
            }

            if (this.parent.#is_dirty) {
                return true;
            }
        }

        return this.#is_global_transform_dirty;
    }

    /**
     * Called when the entity has been updated.
     * Saves the last parent update id, and increments the update id
     * as our global transform has been modified.
     */
    set #is_dirty(value: false) {
        this.#is_global_transform_dirty = value;
        this.#last_update_id++;
        this.#last_parent_update_id = this.parent?._last_update_id ?? 0;
    }

    // No doc comment: the shared base docs are inherited. This override only additionally flags
    // the global transform as needing recomputation whenever the local transform is flagged.
    override updateComponent<_ComponentName extends ComponentName>(
        component_name: _ComponentName,
        value?: Partial<ComponentType<_ComponentName>> | DefaultValue,
    ): void {
        super.updateComponent(component_name, value);
        if (component_name === "local_transform") {
            this.#is_global_transform_dirty = true;
        }
    }

    /**
     * @internal
     *
     * Flag the global transform as needing recomputation when the local transform is updated from an
     * external source.
     *
     * `local_transform` is excluded from the generic merge performed by the base class: that merge
     * uses `Object.assign` and would replace the `position` / `orientation` / `scale` /
     * `eulerOrientation` array references, desyncing them from the proxies created in the
     * `LocalTransformHandler` constructor. `_setLocalTransform` applies the patch in place instead,
     * preserving those references. The (now empty) `local_transform` key is left in place so it
     * still appears in `updated_components` on the dispatched event.
     */
    override _applyComponentsUpdate(params: Parameters<EntityBase["_applyComponentsUpdate"]>[0]): void {
        const local_transform = params.components["local_transform"];
        super._applyComponentsUpdate(
            local_transform ? { ...params, components: { ...params.components, local_transform: {} } } : params,
        );
        if (local_transform) {
            this._setLocalTransform({ local_transform });
        }
    }

    /**
     * @internal
     *
     * Recalculate the local transform of the entity based on the global transform.
     * Does not mark the local transform component as dirty.
     */
    _setGlobalTransform({
        global_transform,
        emitter,
    }: {
        global_transform: Partial<Transform>;
        emitter: Client | null;
    }): void {
        if (global_transform.position) {
            this._setGlobalPosition(global_transform.position);
            vec3.copy(this.#global_transform.position, global_transform.position);
        }

        if (global_transform.orientation) {
            this._setGlobalOrientation(global_transform.orientation);
            quat.copy(this.#global_transform.orientation, global_transform.orientation);
        }

        if (global_transform.eulerOrientation) {
            this._setGlobalEulerOrientation(global_transform.eulerOrientation);
            vec3.copy(this.#global_transform.eulerOrientation, global_transform.eulerOrientation);
        }

        if (global_transform.scale) {
            this._setGlobalScale(global_transform.scale);
            vec3.copy(this.#global_transform.scale, global_transform.scale);
        }

        this._computeTransformMatrices();

        this._dispatchEvent(
            new EntityUpdatedEvent({
                emitter,
                updated_components: ["local_transform"],
                deleted_components: [],
                new_components: [],
            }),
        );
    }

    /**
     * @internal
     *
     * Mark the global transform as needing recalculation.
     *
     * Called when the local transform of the entity has been modified from the proxied object.
     */
    _markGlobalTransformAsDirty(): void {
        this.#is_global_transform_dirty = true;
        this._markLocalTransformAsDirty();
    }

    /**
     * @internal
     *
     * Mark the local transform as dirty
     *
     * Called when the global transform of the entity has been modified, or when the local transform has been modified.
     */
    _markLocalTransformAsDirty(): void {
        this.#last_update_id++;
        this._markComponentAsDirty({ component_name: "local_transform", is_new: false });
    }

    /**
     * @internal
     *
     * If the entity is dirty, recalculate the global transform, then clear the dirty state.
     */
    _recalculateGlobalTransformIfNeeded = (): void => {
        if (this.#is_dirty) {
            this.#computeGlobalPosition();
            this.#computeGlobalOrientation();
            this.#computeGlobalScale();
            this.#computeGlobalEulerOrientation();

            this._computeTransformMatrices();

            //console.debug(`🤓 Recalculating ${this.debug_name?.value} global transform`);
            this.#is_dirty = false;
        }
    };

    /**
     * @internal
     *
     * Compute the local space to world space and world space to local space matrices of the entity.
     */
    _computeTransformMatrices(): void {
        mat4.fromRotationTranslationScale(
            this.#ls_to_ws,
            this.#global_transform.orientation,
            this.#global_transform.position,
            this.#global_transform.scale,
        );

        mat4.invert(this.#ws_to_ls, this.#ls_to_ws);
    }

    /**
     * @internal
     *
     * Set the local transform of the entity.
     * Does not mark the local transform as dirty.
     *
     * Called when the entity is updated from an external source.
     */
    _setLocalTransform({ local_transform }: { local_transform: Partial<Components.LocalTransform> }): void {
        if (local_transform.position) {
            vec3.copy(this.#local_transform.position, local_transform.position);
        }
        // Keep the quaternion orientation and its euler counterpart in sync: recompute whichever the
        // external update omitted, so the two representations never desync.
        if (local_transform.orientation) {
            quat.copy(this.#local_transform.orientation, local_transform.orientation);
            if (!local_transform.eulerOrientation) {
                vec3.copy(this.#local_transform.eulerOrientation, quaternionToEuler(local_transform.orientation));
            }
        }
        if (local_transform.eulerOrientation) {
            vec3.copy(this.#local_transform.eulerOrientation, local_transform.eulerOrientation);
            if (!local_transform.orientation) {
                quat.copy(this.#local_transform.orientation, quaternionFromEuler(local_transform.eulerOrientation));
            }
        }
        if (local_transform.scale) {
            vec3.copy(this.#local_transform.scale, local_transform.scale);
        }
        if (local_transform.globalEulerOrientation) {
            vec3.copy(this.#local_transform.globalEulerOrientation, local_transform.globalEulerOrientation);
        }

        this.#is_global_transform_dirty = true;
        // This path writes the stored component directly, bypassing the base paths that keep the
        // mutate-then-flag rotation shadow fresh — refresh it so a later raw mutation of the pair
        // is attributed to the correct representation.
        this._refreshLocalTransformShadow();
    }

    /**
     * Compute the global position of the entity.
     */
    #computeGlobalPosition(): Vec3 {
        const local_position = this.#local_transform.position;
        if (!this.parent) {
            return vec3.copy(this.#global_transform.position, local_position) as Vec3;
        }

        return vec3.transformMat4(this.#global_transform.position, local_position, this.parent.ls_to_ws) as Vec3;
    }

    /**
     * @internal
     *
     * Set the global position of the entity.
     * Does not mark the local transform as dirty.
     */
    _setGlobalPosition(value: Vec3): void {
        if (!this.parent) {
            vec3.copy(this.#local_transform.position, value);
            return;
        }

        vec3.transformMat4(this.#local_transform.position, value, this.parent.ws_to_ls);
    }

    /**
     * Get the global orientation of the entity.
     * Does not mark the local transform as dirty.
     */
    #computeGlobalOrientation(): Quat {
        if (!this.parent) {
            return quat.copy(this.#global_transform.orientation, this.#local_transform.orientation) as Quat;
        }

        return quat.multiply(
            this.#global_transform.orientation,
            this.parent.global_transform.orientation,
            this.#local_transform.orientation,
        ) as Quat;
    }

    /**
     * @internal
     *
     * Set the global orientation of the entity.
     * Also update the euler orientation.
     * Does not mark the local transform as dirty.
     */
    _setGlobalOrientation(value: Quat): void {
        if (!this.parent) {
            quat.copy(this.#local_transform.orientation, value);
            vec3.copy(this.#local_transform.eulerOrientation, quaternionToEuler(value));
            return;
        }

        const conjugate = quat.conjugate(quat.create(), this.parent.global_transform.orientation);
        const local_orientation = this.#local_transform.orientation;
        quat.multiply(local_orientation, conjugate, value);
        this.#local_transform.eulerOrientation = quaternionToEuler(local_orientation);
    }

    /**
     * Get the global euler orientation of the entity.
     */
    #computeGlobalEulerOrientation(): Vec3 {
        const orientationFromEuler = quaternionFromEuler(this.#local_transform.globalEulerOrientation);
        const isQuaternionEqual = orientationFromEuler.every(
            (value, index) => Math.abs(value - this.#global_transform.orientation[index]) < 0.000001,
        );

        const quat = isQuaternionEqual
            ? this.#local_transform.globalEulerOrientation
            : quaternionToEuler(this.#global_transform.orientation as Quat);

        return vec3.copy(this.#global_transform.eulerOrientation, quat) as Vec3;
    }

    /**
     * Set the global euler orientation of the entity.
     * Also update the quat orientation.
     * Does not mark the local transform as dirty.
     */
    _setGlobalEulerOrientation(value: Vec3): void {
        const orientation = quaternionFromEuler(value);
        this._setGlobalOrientation(orientation);
        vec3.copy(this.#local_transform.globalEulerOrientation, value);
    }

    /**
     * @internal
     *
     * Get the global scale of the entity.
     */
    #computeGlobalScale(): Vec3 {
        const local_scale = this.#local_transform.scale;
        if (!this.parent) {
            return vec3.copy(this.#global_transform.scale, local_scale) as Vec3;
        }

        return vec3.multiply(this.#global_transform.scale, this.parent.global_transform.scale, local_scale) as Vec3;
    }

    /**
     * @internal
     *
     * Set the global scale of the entity.
     * Does not mark the local transform as dirty.
     */
    _setGlobalScale(value: Vec3): void {
        if (!this.parent) {
            vec3.copy(this.#local_transform.scale, value);
            return;
        }

        vec3.divide(this.#local_transform.scale, value, this.parent.global_transform.scale) as Vec3;
    }

    /**
     * The local space to world space matrix of the entity.
     */
    get ls_to_ws(): Readonly<Mat4> {
        this._recalculateGlobalTransformIfNeeded();
        return this.#ls_to_ws;
    }

    /**
     * The world space to local space matrix of the entity.
     */
    get ws_to_ls(): Readonly<Mat4> {
        this._recalculateGlobalTransformIfNeeded();
        return this.#ws_to_ls;
    }

    /**
     * Returns the children of this entity.
     */
    override async getChildren(): Promise<Entity[]> {
        // The base returns a generic EntityBase; we specialize it to the browser flavour.
        return (await super.getChildren()) as Entity[];
    }
}

/**
 * Proxy view over the local transform that flags the entity's global transform dirty on mutation.
 */
class LocalTransformHandler implements Transform {
    #position: Vec3;
    #orientation: Quat;
    #eulerOrientation: Vec3;
    #scale: Vec3;

    /**
     *
     */
    constructor(entity: Entity, local_transform: Components.LocalTransform) {
        const createProxyHandler = <T extends object>(): ProxyHandler<T> => ({
            get: (target, prop): unknown => Reflect.get(target, prop),
            set: (target, prop, value): boolean => {
                const returnValue = Reflect.set(target, prop, value);
                entity._markGlobalTransformAsDirty();
                return returnValue;
            },
        });

        this.#position = new Proxy(local_transform.position, createProxyHandler<Vec3>());
        this.#scale = new Proxy(local_transform.scale, createProxyHandler<Vec3>());

        this.#orientation = new Proxy(local_transform.orientation, {
            get: (_target, prop): unknown => local_transform.orientation[prop as keyof Quat],
            set: (target, prop, value): boolean => {
                const returnValue = Reflect.set(target, prop, value);
                local_transform.eulerOrientation = quaternionToEuler(local_transform.orientation);
                entity._markGlobalTransformAsDirty();
                return returnValue;
            },
        });

        this.#eulerOrientation = new Proxy(local_transform.eulerOrientation, {
            get: (_target, prop): unknown => local_transform.eulerOrientation[prop as keyof Vec3],
            set: (target, prop, value): boolean => {
                const returnValue = Reflect.set(target, prop, value);
                local_transform.orientation = quaternionFromEuler(local_transform.eulerOrientation);
                entity._markGlobalTransformAsDirty();
                return returnValue;
            },
        });
    }

    /**
     *
     */
    get position(): Vec3 {
        return this.#position;
    }

    /**
     *
     */
    get orientation(): Quat {
        return this.#orientation;
    }

    /**
     *
     */
    get eulerOrientation(): Vec3 {
        return this.#eulerOrientation;
    }

    /**
     *
     */
    get scale(): Vec3 {
        return this.#scale;
    }

    /**
     *
     */
    set position(value: Vec3) {
        Object.assign(this.#position, value);
    }

    /**
     *
     */
    set orientation(value: Quat) {
        Object.assign(this.#orientation, value);
    }

    /**
     *
     */
    set eulerOrientation(value: Vec3) {
        Object.assign(this.#eulerOrientation, value);
    }

    /**
     *
     */
    set scale(value: Vec3) {
        Object.assign(this.#scale, value);
    }
}

/**
 * Proxy view over the (derived) global transform. Reads trigger lazy recomputation; writes derive
 * the local transform and flag it dirty.
 */
class GlobalTransformHandler implements Transform {
    #position: Vec3;
    #orientation: Quat;
    #eulerOrientation: Vec3;
    #scale: Vec3;
    #entity: Entity;

    /**
     *
     */
    constructor(_entity: Entity, global_transform: Transform) {
        this.#entity = _entity;
        this.#position = new Proxy(global_transform.position, {
            get: (target, prop): unknown => {
                _entity._recalculateGlobalTransformIfNeeded();
                return Reflect.get(target, prop);
            },
            set: (target, prop, value): boolean => {
                Reflect.set(target, prop, value);
                _entity._setGlobalPosition(target);
                _entity._computeTransformMatrices();
                _entity._markLocalTransformAsDirty();
                return true;
            },
        });

        this.#orientation = new Proxy(global_transform.orientation, {
            get: (target, prop): unknown => {
                _entity._recalculateGlobalTransformIfNeeded();
                return Reflect.get(target, prop);
            },
            set: (target, prop, value): boolean => {
                Reflect.set(target, prop, value);
                _entity._setGlobalOrientation(target);
                _entity._computeTransformMatrices();
                _entity._markLocalTransformAsDirty();
                return true;
            },
        });

        this.#eulerOrientation = new Proxy(global_transform.eulerOrientation, {
            get: (target, prop): unknown => {
                _entity._recalculateGlobalTransformIfNeeded();
                return Reflect.get(target, prop);
            },
            set: (target, prop, value): boolean => {
                Reflect.set(target, prop, value);
                _entity._setGlobalEulerOrientation(target);
                _entity._computeTransformMatrices();
                _entity._markLocalTransformAsDirty();
                return true;
            },
        });

        this.#scale = new Proxy(global_transform.scale, {
            get: (target, prop): unknown => {
                _entity._recalculateGlobalTransformIfNeeded();
                return Reflect.get(target, prop);
            },
            set: (target, prop, value): boolean => {
                Reflect.set(target, prop, value);
                _entity._setGlobalScale(target);
                _entity._computeTransformMatrices();
                _entity._markLocalTransformAsDirty();
                return true;
            },
        });
    }

    /**
     *
     */
    get position(): Vec3 {
        this.#entity._recalculateGlobalTransformIfNeeded();
        return this.#position;
    }

    /**
     *
     */
    get orientation(): Quat {
        this.#entity._recalculateGlobalTransformIfNeeded();
        return this.#orientation;
    }

    /**
     *
     */
    get eulerOrientation(): Vec3 {
        this.#entity._recalculateGlobalTransformIfNeeded();
        return this.#eulerOrientation;
    }

    /**
     *
     */
    get scale(): Vec3 {
        this.#entity._recalculateGlobalTransformIfNeeded();
        return this.#scale;
    }

    /**
     *
     */
    set position(value: Vec3) {
        Object.assign(this.#position, value);
    }

    /**
     *
     */
    set orientation(value: Quat) {
        Object.assign(this.#orientation, value);
    }

    /**
     *
     */
    set eulerOrientation(value: Vec3) {
        Object.assign(this.#eulerOrientation, value);
    }

    /**
     *
     */
    set scale(value: Vec3) {
        Object.assign(this.#scale, value);
    }
}
