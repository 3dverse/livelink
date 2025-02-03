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
    #local_transform: Components.LocalTransform;

    /**
     *
     */
    #local_transform_proxy: Transform;

    /**
     *
     */
    #parent: EntityTransformHandler | null = null;

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
        this.#local_transform_proxy = new LocalTransformHandler(this, this.#local_transform);
        this.#global_transform = new GlobalTransformHandler(this);

        this._unsafeSetComponentValue({ component_name: "local_transform", value: this.#local_transform });
    }

    /**
     * The global transform of the entity.
     */
    get global_transform(): Transform {
        return this.#global_transform;
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
     * @internal
     *
     * Recalculate the local transform of the entity based on the global transform.
     * Does not mark the local transform as dirty.
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
        }

        if (global_transform.orientation) {
            this._setGlobalOrientation(global_transform.orientation);
        }

        if (global_transform.eulerOrientation) {
            this._setGlobalEulerOrientation(global_transform.eulerOrientation);
        }

        if (global_transform.scale) {
            this._setGlobalScale(global_transform.scale);
        }

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
     * Set the local transform of the entity.
     * Does not mark the local transform as dirty.
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
    }

    /**
     * @internal
     *
     * Get the global position of the entity.
     */
    _getGlobalPosition(out: Vec3): Vec3 {
        const local_position = this.#local_transform.position;
        if (!this.#parent) {
            return local_position;
        }

        return vec3.transformMat4(out, local_position, this.#parent.ls_to_ws) as Vec3;
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
     * @internal
     *
     * Get the global orientation of the entity.
     * Does not mark the local transform as dirty.
     */
    _getGlobalOrientation(out: Quat): Quat {
        if (!this.#parent) {
            return this.#local_transform.orientation;
        }

        return quat.multiply(out, this.#parent.global_transform.orientation, this.#local_transform.orientation) as Quat;
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
     * @internal
     *
     * Get the global euler orientation of the entity.
     */
    _getGlobalEulerOrientation(): Vec3 {
        const global_orientation = this.global_transform.orientation;

        const orientationFromEuler = quaternionFromEuler(this.#local_transform.globalEulerOrientation);
        const isQuaternionEqual = orientationFromEuler.every(
            (value, index) => Math.max(value - global_orientation[index]) < 0.000001,
        );

        return isQuaternionEqual
            ? this.#local_transform.globalEulerOrientation
            : quaternionToEuler(global_orientation as Quat);
    }

    /**
     * @internal
     *
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
    _getGlobalScale(out: Vec3): Vec3 {
        const local_scale = this.#local_transform.scale;
        if (!this.#parent) {
            return local_scale;
        }

        return vec3.multiply(out, this.#parent.global_transform.scale, local_scale) as Vec3;
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
    get ls_to_ws(): Mat4 {
        const t = this.#global_transform;
        const ls_to_ws = mat4.create();

        return mat4.fromRotationTranslationScale(ls_to_ws, t.orientation, t.position, t.scale) as Mat4;
    }

    /**
     * The world space to local space matrix of the entity.
     */
    get ws_to_ls(): Mat4 {
        const ls_to_ws = this.ls_to_ws;
        const ws_to_ls = mat4.create();
        return mat4.invert(ws_to_ls, ls_to_ws) as Mat4;
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
                entity._markComponentAsDirty({ component_name: "local_transform" });
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
                entity._markComponentAsDirty({ component_name: "local_transform" });
                return returnValue;
            },
        });

        this.#eulerOrientation = new Proxy(local_transform.eulerOrientation, {
            get: (target, prop): unknown => local_transform.eulerOrientation[prop as keyof Vec3],
            set: (target, prop, value): boolean => {
                const returnValue = Reflect.set(target, prop, value);
                local_transform.orientation = quaternionFromEuler(local_transform.eulerOrientation);
                entity._markComponentAsDirty({ component_name: "local_transform" });
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
    #position_proxy: Vec3;
    #orientation_proxy: Quat;
    #eulerOrientation_proxy: Vec3;
    #scale_proxy: Vec3;

    #position: Vec3 = [0, 0, 0];
    #orientation: Quat = [0, 0, 0, 1];
    #eulerOrientation: Vec3 = [0, 0, 0];
    #scale: Vec3 = [0, 0, 0];

    /**
     *
     */
    constructor(_entity: EntityTransformHandler) {
        this.#position_proxy = new Proxy(this.#position, {
            get: (_target, prop): unknown => {
                const position = _entity._getGlobalPosition(this.#position);
                return position[prop as keyof Vec3];
            },
            set: (_target, prop, value): boolean => {
                Reflect.set(this.#position, prop, value);
                _entity._setGlobalPosition(this.#position);
                _entity._markComponentAsDirty({ component_name: "local_transform" });
                return true;
            },
        });

        this.#orientation_proxy = new Proxy(this.#orientation, {
            get: (_target, prop): unknown => {
                const orientation = _entity._getGlobalOrientation(this.#orientation);
                return orientation[prop as keyof Quat];
            },
            set: (_target, prop, value): boolean => {
                Reflect.set(this.#orientation, prop, value);
                _entity._setGlobalOrientation(this.#orientation);
                _entity._markComponentAsDirty({ component_name: "local_transform" });
                return true;
            },
        });

        this.#eulerOrientation_proxy = new Proxy(this.#eulerOrientation, {
            get: (_target, prop): unknown => {
                const euler_orientation = _entity._getGlobalEulerOrientation();
                return euler_orientation[prop as keyof Vec3];
            },
            set: (_target, prop, value): boolean => {
                Reflect.set(this.#eulerOrientation, prop, value);
                _entity._setGlobalEulerOrientation(this.#eulerOrientation);
                _entity._markComponentAsDirty({ component_name: "local_transform" });
                return true;
            },
        });

        this.#scale_proxy = new Proxy(this.#scale, {
            get: (_target, prop): unknown => {
                const scale = _entity._getGlobalScale(this.#scale);
                return scale[prop as unknown as keyof Vec3];
            },
            set: (_target, prop, value): boolean => {
                Reflect.set(this.#scale, prop, value);
                _entity._setGlobalScale(this.#scale);
                _entity._markComponentAsDirty({ component_name: "local_transform" });
                return true;
            },
        });
    }

    /**
     *
     */
    get position(): Vec3 {
        return this.#position_proxy;
    }

    /**
     *
     */
    get orientation(): Quat {
        return this.#orientation_proxy;
    }

    /**
     *
     */
    get eulerOrientation(): Vec3 {
        return this.#eulerOrientation_proxy;
    }

    /**
     *
     */
    get scale(): Vec3 {
        return this.#scale_proxy;
    }

    /**
     *
     */
    set position(value: Vec3) {
        Object.assign(this.#position_proxy, value);
    }

    /**
     *
     */
    set orientation(value: Quat) {
        Object.assign(this.#orientation_proxy, value);
    }

    /**
     *
     */
    set eulerOrientation(value: Vec3) {
        Object.assign(this.#eulerOrientation_proxy, value);
    }

    /**
     *
     */
    set scale(value: Vec3) {
        Object.assign(this.#scale_proxy, value);
    }
}
