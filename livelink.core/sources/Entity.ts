import { LivelinkCore } from "./LivelinkCore";
import { EditorEntity } from "../_prebuild/types";
import {
    ComponentHash,
    type AABB,
    type AnimationController,
    type BoxGeometry,
    type Camera,
    type CapsuleGeometry,
    type ComponentType,
    type DebugName,
    type Euid,
    type Lineage,
    type MaterialRef,
    type MeshRef,
    type OrthographicLens,
    type PerspectiveLens,
    type PointLight,
    type RigidBody,
    type SceneRef,
    type ScriptMap,
    type SkeletonRef,
    type SphereGeometry,
    type Transform,
} from "../_prebuild/types/components";
import { RTID, UUID } from "./types";

/**
 *
 */
type EntityAutoUpdateState = "on" | "off";

/**
 *
 */
type EntityEventType = "entity-updated";

/**
 *
 */
export class Entity extends EventTarget {
    private euid: Euid | null = null;
    debug_name?: DebugName;
    lineage?: Lineage;
    scene_ref?: SceneRef;
    mesh_ref?: MeshRef;
    material_ref?: MaterialRef;
    skeleton_ref?: SkeletonRef;
    animation_controller?: AnimationController;
    script_map?: ScriptMap;
    local_aabb?: AABB;
    box_geometry?: BoxGeometry;
    sphere_geometry?: SphereGeometry;
    capsule_geometry?: CapsuleGeometry;
    rigid_body?: RigidBody;
    perspective_lens?: PerspectiveLens;
    orthographic_lens?: OrthographicLens;
    camera?: Camera;
    local_transform?: Transform;
    point_light: PointLight;

    /**
     *
     */
    private _auto_update: EntityAutoUpdateState = "on";

    /**
     *
     */
    get rtid(): RTID | null {
        return this.euid?.rtid ?? null;
    }
    /**
     *
     */
    get id(): UUID | null {
        return this.euid?.value ?? null;
    }
    /**
     *
     */
    get name(): string {
        return this.debug_name?.value ?? "<unnamed>";
    }

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
    constructor(protected readonly _core: LivelinkCore) {
        super();
    }

    /**
     *
     */
    init(from: EditorEntity | string) {
        if (typeof from === "string") {
            this.debug_name = { value: from };
        } else {
            this._parse({ editor_entity: from });
        }

        return this;
    }

    /**
     *
     */
    isInstantiated(): boolean {
        return this.euid !== null;
    }

    /**
     *
     */
    onCreate() {}

    /**
     *
     */
    onUpdate({ elapsed_time }: { elapsed_time: number }) {}

    /**
     *
     */
    onTriggerEntered() {
        this.dispatchEvent(new CustomEvent("trigger-entered"));
    }

    /**
     *
     */
    onTriggerExited() {
        this.dispatchEvent(new CustomEvent("trigger-exited"));
    }

    /**
     *
     */
    async instantiate() {
        if (this.isInstantiated()) {
            throw new Error("Entity is already instantiated");
        }

        const editor_entity = await this._core.createEntity({ entity: this });
        this._parse({ editor_entity });
        this._core.entity_registry.add({ entity: this });
    }

    /**
     *
     */
    toJSON() {
        let serialized = {};
        for (const p in this) {
            if (this[p] !== undefined && p[0] !== "_" && p !== "euid") {
                serialized[p as string] = this[p];
            }
        }
        return serialized;
    }

    /**
     *
     */
    _updateFromEvent({ updated_components }: { updated_components: Record<string, unknown> }) {
        this._auto_update = "off";
        for (const key in updated_components) {
            this[key] = updated_components[key];
        }
        this._auto_update = "on";

        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     *
     */
    _tryMarkingAsDirty({ component_type }: { component_type: ComponentType }): boolean {
        if (this.isInstantiated()) {
            // Register to appropriate dirty list
            this._core.entity_registry._addEntityToUpdate({
                component_type,
                entity: this,
            });
            return true;
        }

        return false;
    }

    /**
     *
     */
    private _parse({ editor_entity }: { editor_entity: EditorEntity }) {
        for (const component_name in editor_entity.components) {
            this[component_name] = editor_entity.components[component_name];
        }

        // Remove any undefined component
        for (const k of Object.keys(this)) {
            if (this[k] === undefined) {
                delete this[k];
            }
        }

        const components = editor_entity.components as {
            euid: Euid;
            debug_name: DebugName;
            local_transform: Transform;
        };

        this.euid = {
            value: components.euid.value,
            rtid: BigInt(editor_entity.rtid),
        };

        this.local_transform = components.local_transform;

        this.debug_name = components.debug_name;
    }

    /**
     *
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

            if (entity._auto_update === "off") {
                return value;
            }

            if (
                typeof prop === "string" &&
                entity[prop] !== undefined &&
                prop[0] !== "_" &&
                Object.values(ComponentHash).includes(prop)
            ) {
                //console.log("GET COMPONENT", entity, prop);
                return new Proxy(entity[prop], new ComponentHandler(entity, prop as ComponentType));
            }

            return value;
        },

        set(entity: Entity, prop: PropertyKey, v: any): boolean {
            if (entity._auto_update === "off") {
                return Reflect.set(entity, prop, v);
            }

            if (typeof prop === "string" && Object.values(ComponentHash).includes(prop)) {
                //console.log("SET COMPONENT", prop, v);
                entity._tryMarkingAsDirty({ component_type: prop as ComponentType });
            }
            return Reflect.set(entity, prop, v);
        },

        deleteProperty(entity: Entity, prop: PropertyKey): boolean {
            //console.log("DELETE COMPONENT", prop);
            return Reflect.deleteProperty(entity, prop);
        },
    };
}

/**
 *
 */
class ComponentHandler {
    constructor(
        private readonly _entity: Entity,
        private readonly _component_name: ComponentType,
    ) {}

    get(component: object, prop: PropertyKey): unknown {
        //console.log("GET ATTRIBUTE", prop);
        if (prop[0] !== "_") {
            if ((typeof component[prop] === "object" && component[prop] !== null) || Array.isArray(component[prop])) {
                return new Proxy(component[prop], new ComponentHandler(this._entity, this._component_name));
            }
        }
        return Reflect.get(component, prop);
    }

    set(component: object, prop: PropertyKey, v: any): boolean {
        //console.log("SET ATTRIBUTE", prop, v);
        this._entity._tryMarkingAsDirty({ component_type: this._component_name });
        return Reflect.set(component, prop, v);
    }

    deleteProperty(component: object, prop: PropertyKey): boolean {
        //console.log("DELETE ATTRIBUTE", prop);
        return Reflect.deleteProperty(component, prop);
    }
}
