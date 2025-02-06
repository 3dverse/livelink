//------------------------------------------------------------------------------
import type { ComponentName, Components, Mat4, Quat, Vec3 } from "@3dverse/livelink.core";
import { mat4, quat, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import { EntityBase } from "../../_prebuild/EntityBase";

//------------------------------------------------------------------------------
import { EntityUpdatedEvent } from "./EntityEvents";
import { quaternionFromEuler, quaternionToEuler } from "../maths";

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
 * @category Scene
 */
export abstract class EntityTransformHandler extends EntityBase {
    /**
     *
     */
    #global_transform: Transform;

    /**
     *
     */
    #global_transform_proxy: GlobalTransformHandler;

    /**
     *
     */
    #local_transform: Components.LocalTransform;

    /**
     *
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
     *
     */
    #parent: EntityTransformHandler | null = null;

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
     *
     */
    constructor({
        euid,
        local_transform,
        parent,
    }: {
        euid: Components.Euid;
        local_transform: Components.LocalTransform;
        parent: EntityTransformHandler | null;
    }) {
        super({ euid });

        this.#parent = parent;
        this.#local_transform = local_transform;
        this.#global_transform = {
            position: [0, 0, 0],
            orientation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            eulerOrientation: [0, 0, 0],
        };

        this.#local_transform_proxy = new LocalTransformHandler(this, this.#local_transform);
        this.#global_transform_proxy = new GlobalTransformHandler(this, this.#global_transform);

        this._unsafeSetComponentValue({ component_name: "local_transform", value: this.#local_transform });
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
        this._setGlobalTransform({ global_transform: value, change_source: "local" });
        this._markComponentAsDirty({ component_name: "local_transform" });
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
        Object.assign(this.#local_transform_proxy, value);
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
    get parent(): EntityTransformHandler | null {
        return this.#parent;
    }

    /**
     *
     */
    set parent(_parent: EntityTransformHandler | null) {
        throw new Error("Not implemented");
    }

    /**
     * Check if the entity global transform, or any of its ancestors global transform,
     * has been modified since the last calculation.
     */
    get #is_dirty(): boolean {
        if (this.#parent) {
            if (this.#parent._last_update_id !== this.#last_parent_update_id) {
                return true;
            }

            if (this.#parent.#is_dirty) {
                return true;
            }
        }

        return this.#is_global_transform_dirty;
    }

    /**
     * Called when the entity has been updated from the proxy object.
     * Saves the last parent update id, and increments the update id
     * as our global transform has been modified.
     */
    set #is_dirty(value: false) {
        this.#is_global_transform_dirty = value;
        this.#last_update_id++;
        this.#last_parent_update_id = this.#parent?._last_update_id ?? 0;
    }

    /**
     * @internal
     *
     * Recalculate the local transform of the entity based on the global transform.
     * Does not mark the local transform component as dirty.
     */
    _setGlobalTransform({
        global_transform,
        change_source,
    }: {
        global_transform: Partial<Transform>;
        change_source: "local" | "external";
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
                change_source,
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
        this._markComponentAsDirty({ component_name: "local_transform" });
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
        if (local_transform.orientation) {
            quat.copy(this.#local_transform.orientation, local_transform.orientation);
        }
        if (local_transform.eulerOrientation) {
            vec3.copy(this.#local_transform.eulerOrientation, local_transform.eulerOrientation);
        }
        if (local_transform.scale) {
            vec3.copy(this.#local_transform.scale, local_transform.scale);
        }
        if (local_transform.globalEulerOrientation) {
            vec3.copy(this.#local_transform.globalEulerOrientation, local_transform.globalEulerOrientation);
        }

        this.#is_global_transform_dirty = true;
    }

    /**
     * Compute the global position of the entity.
     */
    #computeGlobalPosition(): Vec3 {
        const local_position = this.#local_transform.position;
        if (!this.#parent) {
            return vec3.copy(this.#global_transform.position, local_position) as Vec3;
        }

        return vec3.transformMat4(this.#global_transform.position, local_position, this.#parent.ls_to_ws) as Vec3;
    }

    /**
     * @internal
     *
     * Set the global position of the entity.
     * Does not mark the local transform as dirty.
     */
    _setGlobalPosition(value: Vec3): void {
        if (!this.#parent) {
            vec3.copy(this.#local_transform.position, value);
            return;
        }

        vec3.transformMat4(this.#local_transform.position, value, this.#parent.ws_to_ls);
    }

    /**
     * Get the global orientation of the entity.
     * Does not mark the local transform as dirty.
     */
    #computeGlobalOrientation(): Quat {
        if (!this.#parent) {
            return quat.copy(this.#global_transform.orientation, this.#local_transform.orientation) as Quat;
        }

        return quat.multiply(
            this.#global_transform.orientation,
            this.#parent.global_transform.orientation,
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
        if (!this.#parent) {
            quat.copy(this.#local_transform.orientation, value);
            vec3.copy(this.#local_transform.eulerOrientation, quaternionToEuler(value));
            return;
        }

        const conjugate = quat.conjugate(quat.create(), this.#parent.global_transform.orientation);
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
            (value, index) => Math.max(value - this.#global_transform.orientation[index]) < 0.000001,
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
        if (!this.#parent) {
            return vec3.copy(this.#global_transform.scale, local_scale) as Vec3;
        }

        return vec3.multiply(this.#global_transform.scale, this.#parent.global_transform.scale, local_scale) as Vec3;
    }

    /**
     * @internal
     *
     * Set the global scale of the entity.
     * Does not mark the local transform as dirty.
     */
    _setGlobalScale(value: Vec3): void {
        if (!this.#parent) {
            vec3.copy(this.#local_transform.scale, value);
            return;
        }

        vec3.divide(this.#local_transform.scale, value, this.#parent.global_transform.scale) as Vec3;
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
     * @internal
     */
    abstract _markComponentAsDirty({ component_name }: { component_name: ComponentName }): void;
}

/**
 *
 */
class LocalTransformHandler implements Transform {
    #position: Vec3;
    #orientation: Quat;
    #eulerOrientation: Vec3;
    #scale: Vec3;

    /**
     *
     */
    constructor(entity: EntityTransformHandler, local_transform: Components.LocalTransform) {
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
            get: (target, prop): unknown => local_transform.orientation[prop as keyof Quat],
            set: (target, prop, value): boolean => {
                const returnValue = Reflect.set(target, prop, value);
                local_transform.eulerOrientation = quaternionToEuler(local_transform.orientation);
                entity._markGlobalTransformAsDirty();
                return returnValue;
            },
        });

        this.#eulerOrientation = new Proxy(local_transform.eulerOrientation, {
            get: (target, prop): unknown => local_transform.eulerOrientation[prop as keyof Vec3],
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
 *
 */
class GlobalTransformHandler implements Transform {
    #position: Vec3;
    #orientation: Quat;
    #eulerOrientation: Vec3;
    #scale: Vec3;

    /**
     *
     */
    constructor(_entity: EntityTransformHandler, global_transform: Transform) {
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
