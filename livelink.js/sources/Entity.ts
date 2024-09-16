import type {
    ComponentType,
    EditorEntity,
    EntityCreationOptions,
    Quat,
    RTID,
    UUID,
    Vec3,
} from "@3dverse/livelink.core";
import { EntityBase } from "../_prebuild/EntityBase";
import { Scene } from "./Scene";
import { LivelinkCoreModule } from "@3dverse/livelink.core";

/**
 *
 */
type EntityAutoUpdateState = "on" | "off";

/**
 *
 */
class InvalidEntityError extends Error {}

/**
 *
 */
export class Entity extends EntityBase {
    /**
     *
     */
    private _proxy_state: EntityAutoUpdateState = "on";

    /**
     *
     */
    private _auto_update: EntityAutoUpdateState = "on";

    /**
     *
     */
    private _auto_broadcast: EntityAutoUpdateState = "on";

    /**
     *
     */
    private _parentEntity: Entity | null = null;

    /**
     *
     */
    get auto_update(): EntityAutoUpdateState {
        return this._auto_update;
    }
    /**
     *
     */
    set auto_update(state: EntityAutoUpdateState) {
        this._auto_update = state;
    }

    /**
     *
     */
    get auto_broadcast(): EntityAutoUpdateState {
        return this._auto_broadcast;
    }
    /**
     *
     */
    set auto_broadcast(state: EntityAutoUpdateState) {
        this._auto_broadcast = state;
    }

    /**
     * @internal
     */
    constructor(private readonly _scene: Scene) {
        super();
    }

    /**
     * @internal
     */
    init(from: EditorEntity | string, euid?: UUID) {
        if (typeof from === "string") {
            this.debug_name = { value: from };
            this._proxy_state = "off";
        } else {
            this._parse({ editor_entity: from });
        }

        if (euid) {
            this._setEuid(euid);
        }

        return this;
    }

    /**
     * @internal
     */
    onCreate() {}

    /**
     * @internal
     */
    onUpdate({ elapsed_time }: { elapsed_time: number }) {}

    /**
     * @internal
     */
    onTriggerEntered({ entity }: { entity: Entity }) {
        this.dispatchEvent(new CustomEvent("trigger-entered", { detail: { entity } }));
    }

    /**
     * @internal
     */
    onTriggerExited({ entity }: { entity: Entity }) {
        this.dispatchEvent(new CustomEvent("trigger-exited", { detail: { entity } }));
    }

    /**
     * @internal
     */
    onScriptEventTarget({
        event_name,
        data_object,
        emitter_rtid,
    }: {
        event_name: string;
        data_object: Record<string, {}> | null;
        emitter_rtid: RTID;
    }) {
        this.dispatchEvent(
            new CustomEvent("on-script-event-target", {
                detail: {
                    event_name,
                    data_object,
                    emitter_rtid,
                },
            }),
        );
    }

    /**
     * @internal
     */
    onScriptEventEmitter({
        event_name,
        data_object,
        target_rtids,
    }: {
        event_name: string;
        data_object: Record<string, {}> | null;
        target_rtids: RTID[];
    }) {
        this.dispatchEvent(
            new CustomEvent("on-script-event-emitter", {
                detail: {
                    event_name,
                    data_object,
                    target_rtids,
                },
            }),
        );
    }

    /**
     * @internal
     */
    async _instantiate(promise: Promise<EditorEntity>) {
        if (this.isInstantiated()) {
            throw new Error("Entity is already instantiated");
        }

        const editor_entity = await promise;
        this._parse({ editor_entity });
        this._scene.entity_registry.add({ entity: this });
        this._proxy_state = "on";
    }

    /**
     * @internal
     */
    _setParent(entity: Entity | null) {
        this._parentEntity = entity;
    }

    /**
     *
     */
    async getChildren(): Promise<Entity[]> {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }

        return await this._scene._getChildren({ entity_rtid: this.rtid });
    }

    /**
     *
     */
    getParent(): Entity | null {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }
        return this._parentEntity;
    }

    /**
     *
     */
    async assignClientToScripts({ client_uuid }: { client_uuid: UUID }): Promise<void> {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }

        if (!this.script_map || !this.script_map.elements) {
            throw new Error("Entity has no scripts");
        }
        const script_ids = Object.keys(this.script_map.elements);
        await Promise.all(
            script_ids.map(script_id =>
                this._scene._assignClientToScripts({ client_uuid, entity_rtid: this.rtid!, script_uuid: script_id }),
            ),
        );
    }

    /**
     * @internal
     */
    _updateFromEvent({ updated_components }: { updated_components: Record<string, unknown> }) {
        this._proxy_state = "off";
        for (const key in updated_components) {
            //@ts-ignore: the update message is guaranteed to contain only valid components
            this[key] = updated_components[key];
        }
        this._proxy_state = "on";

        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     * @internal
     */
    _tryMarkingAsDirty({ component_type }: { component_type: ComponentType }): boolean {
        if (this.isInstantiated()) {
            // Register to appropriate dirty list
            this._scene.entity_registry._addEntityToUpdate({ component_type, entity: this });
            return true;
        }

        return false;
    }

    /**
     * @internal
     */
    _tryMarkingAsDeleted({ component_type }: { component_type: ComponentType }): boolean {
        if (this.isInstantiated()) {
            // Register to appropriate dirty list
            this._scene.entity_registry._detachComponentFromEntity({ component_type, entity: this });
            this.dispatchEvent(new CustomEvent("entity-updated"));
            return true;
        }

        return false;
    }

    /**
     * @internal
     */
    _setLocalTransform({ position, orientation }: { position: Vec3; orientation: Quat }) {
        this._proxy_state = "off";
        this._auto_update = "off";
        this.local_transform!.position = position;
        this.local_transform!.orientation = orientation;
        this._auto_update = "on";
        this._proxy_state = "on";
    }

    /**
     * @internal
     */
    static handler = {
        get(entity: Entity, prop: PropertyKey, receiver: unknown): unknown {
            const value = Reflect.get(entity, prop, receiver);
            if (
                typeof value === "function" &&
                ["addEventListener", "removeEventListener", "dispatchEvent"].includes(prop as string)
            ) {
                return value.bind(entity);
            }

            if (entity._proxy_state === "off") {
                return value;
            }

            //@ts-ignore
            if (entity._isSerializableComponent(prop, entity[prop])) {
                //console.log("GET COMPONENT", entity, prop);
                const Handler = prop === "local_transform" ? LocalTransformHandler : ComponentHandler;
                //@ts-ignore
                return new Proxy(entity[prop], new Handler(entity, prop as ComponentType));
            }

            return value;
        },

        set(entity: Entity, prop: PropertyKey, v: any): boolean {
            if (entity._proxy_state === "off") {
                return Reflect.set(entity, prop, v);
            }

            if (entity._isSerializableComponent(prop, v)) {
                //console.log("SET COMPONENT", prop, v);
                entity._tryMarkingAsDirty({ component_type: prop as ComponentType });
            }

            return Reflect.set(entity, prop, v);
        },

        deleteProperty(entity: Entity, prop: PropertyKey): boolean {
            //@ts-ignore
            if (entity[prop] !== undefined) {
                //console.log("DELETE COMPONENT", prop);
                entity._tryMarkingAsDeleted({ component_type: prop as ComponentType });
            }

            return Reflect.deleteProperty(entity, prop);
        },
    };
}

/**
 *
 */
class ComponentHandler {
    /**
     *
     */
    constructor(
        private readonly _entity: Entity,
        private readonly _component_type: ComponentType,
    ) {}

    /**
     *
     */
    get(component: object, prop: PropertyKey): unknown {
        //console.log("GET ATTRIBUTE", prop);
        //@ts-ignore
        if (prop[0] !== "_") {
            //@ts-ignore
            if ((typeof component[prop] === "object" && component[prop] !== null) || Array.isArray(component[prop])) {
                //@ts-ignore
                return new Proxy(component[prop], new ComponentHandler(this._entity, this._component_type));
            }
        }
        return Reflect.get(component, prop);
    }

    /**
     *
     */
    set(component: object, prop: PropertyKey, v: any): boolean {
        //console.log("SET ATTRIBUTE", prop, v);
        this._entity._tryMarkingAsDirty({ component_type: this._component_type });
        return Reflect.set(component, prop, v);
    }

    /**
     *
     */
    deleteProperty(component: object, prop: PropertyKey): boolean {
        //TODO: reset to default?
        //console.log("DELETE ATTRIBUTE", prop);
        return Reflect.deleteProperty(component, prop);
    }
}

/**
 *
 */
class LocalTransformHandler extends ComponentHandler {
    /**
     *
     */
    set(component: object, prop: PropertyKey, v: any): boolean {
        switch (prop) {
            case "orientation":
                Reflect.set(component, "eulerOrientation", quaternionToEuler(v));
                break;

            case "eulerOrientation":
                Reflect.set(component, "orientation", quaternionFromEuler(v));
                break;
        }

        return super.set(component, prop, v);
    }
}

/**
 *
 */
function quaternionToEuler([x, y, z, w]: Quat): Vec3 {
    const euler = { roll: 0.0, pitch: 0.0, yaw: 0.0 };
    const q = { x, y, z, w };

    // roll (x-axis rotation)
    let sinr_cosp = +2.0 * (q.w * q.x + q.y * q.z);
    let cosr_cosp = +1.0 - 2.0 * (q.x * q.x + q.y * q.y);
    euler.roll = Math.atan2(sinr_cosp, cosr_cosp);

    // pitch (y-axis rotation)
    let sinp = +2.0 * (q.w * q.y - q.z * q.x);
    if (Math.abs(sinp) >= 1) {
        euler.pitch = copySign(Math.PI / 2, sinp); // use 90 degrees if out of range
    } else {
        euler.pitch = Math.asin(sinp);
    }

    // yaw (z-axis rotation)
    let siny_cosp = +2.0 * (q.w * q.z + q.x * q.y);
    let cosy_cosp = +1.0 - 2.0 * (q.y * q.y + q.z * q.z);
    euler.yaw = Math.atan2(siny_cosp, cosy_cosp);

    return [euler.roll, euler.pitch, euler.yaw].map(radian => (radian * 180.0) / Math.PI) as Vec3;
}

/**
 *
 */
function quaternionFromEuler(eulers: Vec3): Quat {
    const [roll, pitch, yaw] = eulers.map(degree => (degree * Math.PI) / 180.0);

    const cy = Math.cos(yaw / 2);
    const sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2);
    const sp = Math.sin(pitch / 2);
    const cr = Math.cos(roll / 2);
    const sr = Math.sin(roll / 2);

    return [
        cy * cp * sr - sy * sp * cr,
        sy * cp * sr + cy * sp * cr,
        sy * cp * cr - cy * sp * sr,
        cy * cp * cr + sy * sp * sr,
    ];
}

/**
 *
 */
function copySign(a: number, b: number): number {
    return b < 0 ? -Math.abs(a) : Math.abs(a);
}
