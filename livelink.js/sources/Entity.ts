import type { ComponentType, EditorEntity, Quat, RTID, UUID, Vec2, Vec3, Vec4 } from "@3dverse/livelink.core";
import { EntityBase } from "../_prebuild/EntityBase";
import { Scene } from "./Scene";
import { ComponentHandler, ComponentHandlers, LocalTransformHandler } from "./ComponentHandler";
import { ComponentsRecord } from "../_prebuild/ComponentsRecord";

/**
 *
 */
export { ComponentsRecord } from "../_prebuild/ComponentsRecord";

/**
 *
 */
export type RenderGraphDataObject = Record<string, Vec4 | Vec3 | Vec2 | number | boolean>;
export type ScriptDataObject = Record<string, Quat | Vec4 | Vec3 | Vec2 | number | boolean | UUID | string>;
export type AnimationSequenceDataObject = Record<string, Quat | Vec4 | Vec3 | Vec2 | number | boolean | UUID | string>;
export type ShaderDataObject = Record<string, Vec4 | Vec3 | Vec2 | number | boolean | UUID>;
export type AnimationGraphDataObject = Record<string, Vec3 | number | boolean | UUID>;

/**
 *
 */
type InitFromEditor = { editor_entity: EditorEntity };
type InitFromComponents = { name: string; components?: ComponentsRecord };
type EntityInitOptions = InitFromEditor | InitFromComponents;

/**
 *
 */
type EntityAutoUpdateState = "on" | "off";

/**
 *
 */
class InvalidEntityError extends Error {}

/**
 * @category Entity
 */
export class Entity extends EntityBase {
    /**
     *
     */
    private readonly _scene: Scene;

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
     *
     */
    get scene() {
        return this._scene;
    }

    /**
     *
     */
    get is_visible() {
        return this._is_visible;
    }

    /**
     *
     */
    set is_visible(val: boolean) {
        this.scene._setEntityVisibility({ entity_rtid: this.rtid!, is_visible: val });
        this._is_visible = val;
    }

    /**
     * @internal
     */
    constructor({ scene, ...init }: { scene: Scene } & EntityInitOptions) {
        super();

        this._scene = scene;

        if ("editor_entity" in init) {
            this._initFromEditorEntity({ editor_entity: init.editor_entity });
        } else {
            this._initFromComponents({ name: init.name, components: init.components });
        }
    }

    /**
     *
     */
    private _initFromComponents({ name, components }: { name: string; components?: ComponentsRecord }) {
        this.debug_name = { value: name };
        if (components) {
            this._mergeComponents({ components, dispatch_event: false });
        }
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
    _instantiate({
        editor_entity,
        proxy_state = "on",
    }: {
        editor_entity: EditorEntity;
        proxy_state: EntityAutoUpdateState;
    }) {
        if (this.isInstantiated()) {
            throw new Error("Entity is already instantiated");
        }

        this._initFromEditorEntity({ editor_entity });
        this._scene.entity_registry.add({ entity: this });
        this._proxy_state = proxy_state;
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
    _mergeComponents({
        components,
        dispatch_event = true,
    }: {
        components: ComponentsRecord;
        dispatch_event?: boolean;
    }) {
        this._proxy_state = "off";
        for (const key in components) {
            //@ts-ignore
            this[key] = { ...this[key], ...components[key] };
        }
        this._proxy_state = "on";

        if (dispatch_event) {
            this.dispatchEvent(new CustomEvent("entity-updated"));
        }
    }

    /**
     * @internal
     */
    _setComponentsFromEditor({ components }: { components: ComponentsRecord }) {
        // Turn off the proxy as this is already a validated message from the editor.
        this._proxy_state = "off";

        // The update message from the editor is guaranteed to contain only valid components
        // so we don't need to merge with the current values.
        for (const key in components) {
            //@ts-ignore
            this[key] = components[key];
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
            this.dispatchEvent(new CustomEvent("entity-updated"));
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
    _onVisibilityChanged({ is_visible }: { is_visible: boolean }) {
        this._is_visible = is_visible;
        this.dispatchEvent(new CustomEvent("visibility-changed", { detail: { is_visible } }));
    }

    /**
     *
     */
    _addComponentDefaultValues({
        component_default_values,
    }: {
        component_default_values: ReadonlyMap<ComponentType, object>;
    }) {
        this._proxy_state = "off";
        for (const [component_type, default_value] of component_default_values) {
            if (this[component_type]) {
                //@ts-ignore
                this[component_type] = { ...structuredClone(default_value), ...this[component_type] };
            }
        }
        this._proxy_state = "on";
    }

    /**
     * @internal
     */
    static serializableComponentsProxies = {
        ["local_transform"]: LocalTransformHandler,
        ["default"]: ComponentHandler,
    } as ComponentHandlers;

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
                //console.log("GET COMPONENT", entity,prop);
                const serializableComponentsProxies =
                    Object.getPrototypeOf(entity).constructor.serializableComponentsProxies;

                const Handler =
                    serializableComponentsProxies[prop as ComponentType] ?? serializableComponentsProxies["default"];
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
                const defaultValue = entity.scene.entity_registry._getComponentDefaultValue({
                    component_type: prop as ComponentType,
                });
                v = { ...structuredClone(defaultValue), ...v };
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
