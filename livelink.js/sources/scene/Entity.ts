//------------------------------------------------------------------------------
import type {
    ComponentsRecord,
    ComponentName,
    EditorEntity,
    RTID,
    ScriptDataObject,
    UUID,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { EntityBase } from "../../_prebuild/EntityBase";

//------------------------------------------------------------------------------
import { Scene } from "./Scene";
import { ComponentHandler, ComponentHandlers, LocalTransformHandler } from "./ComponentHandler";

/**
 *
 */
type InitFromEditor = { editor_entity: EditorEntity };
type InitFromComponents = { name: string; components?: Partial<ComponentsRecord> };
type EntityInitOptions = InitFromEditor | InitFromComponents;

/**
 *
 */
class InvalidEntityError extends Error {}

/**
 * @category Scene
 */
export type EntityAutoUpdateState = "on" | "off";

/**
 * An entity in a scene.
 *
 * An entity is a collection of components.
 *
 * This class embeds a proxy to monitor component access and mark the entity as dirty when
 * a component is added, modified or deleted.
 *
 * All relevant modifications to entities are batched and sent to the server if the `auto_update`
 * property is set to "on" and broadcasted to other clients if the `auto_broadcast` property is
 * set to "on".
 *
 * This class provides helper methods to retrieve the parent entity and the children entities.
 *
 * This class cannot be instantiated directly.
 * Use the {@link Scene.newEntity} or {@link Scene.newEntities} methods on an existing scene to
 * create an entity.
 *
 * @category Scene
 */
export class Entity extends EntityBase {
    /**
     *
     */
    private readonly _scene: Scene;

    /**
     *
     */
    private _proxy_state: EntityAutoUpdateState = "off";

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
     * Whether the entity has its components updates sent to the server.
     */
    get auto_update(): EntityAutoUpdateState {
        return this._auto_update;
    }

    /**
     * Set whether the entity has its components updates sent to the server.
     */
    set auto_update(state: EntityAutoUpdateState) {
        this._auto_update = state;
    }

    /**
     * Whether the entity has its components updates broadcasted to other clients.
     */
    get auto_broadcast(): EntityAutoUpdateState {
        return this._auto_broadcast;
    }

    /**
     * Set whether the entity has its components updates broadcasted to other clients.
     */
    set auto_broadcast(state: EntityAutoUpdateState) {
        this._auto_broadcast = state;
    }

    /**
     * Whether the entity is visible.
     */
    get is_visible(): boolean {
        return this._is_visible;
    }

    /**
     * Set whether the entity is visible.
     */
    set is_visible(is_visible: boolean) {
        this._scene._setEntityVisibility({ entity_rtid: this.rtid!, is_visible });
        this._is_visible = is_visible;
    }

    /**
     * The parent entity of this entity or null if it has no parent.
     */
    get parent(): Entity | null {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }
        return this._parentEntity;
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
    async getChildren(): Promise<Entity[]> {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }

        return await this._scene._getChildren({ entity_rtid: this.rtid });
    }

    /**
     * @experimental
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
    private _initFromComponents({ name, components }: { name: string; components?: Partial<ComponentsRecord> }): void {
        this.debug_name = { value: name };
        if (components) {
            this._mergeComponents({ components, dispatch_event: false });
        }
    }

    /**
     * @internal
     * @experimental
     */
    onScriptEventTarget({
        event_name,
        data_object,
        emitter_rtid,
    }: {
        event_name: string;
        data_object: ScriptDataObject | null;
        emitter_rtid: RTID;
    }): void {
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
     * @experimental
     */
    onScriptEventEmitter({
        event_name,
        data_object,
        target_rtids,
    }: {
        event_name: string;
        data_object: ScriptDataObject | null;
        target_rtids: RTID[];
    }): void {
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
    }): void {
        if (this._isInstantiated()) {
            throw new Error("Entity is already instantiated");
        }

        this._initFromEditorEntity({ editor_entity });
        this._scene.entity_registry.add({ entity: this });
        this._proxy_state = proxy_state;
    }

    /**
     * @internal
     */
    _setParent(entity: Entity | null): void {
        this._parentEntity = entity;
    }

    /**
     * @internal
     */
    _mergeComponents({
        components,
        dispatch_event = true,
    }: {
        components: Partial<ComponentsRecord>;
        dispatch_event?: boolean;
    }): void {
        const actual_proxy_state = this._proxy_state;
        this._proxy_state = "off";

        for (const strKey in components) {
            const key = strKey as keyof ComponentsRecord;
            //@ts-expect-error: typescript doesn't like the assignment to this[key] as the attribute might be readonly,
            // even if we know it's not.
            this[key] = { ...this[key], ...components[key] };
        }
        this._proxy_state = actual_proxy_state;

        if (dispatch_event) {
            this.dispatchEvent(new CustomEvent("entity-updated"));
        }
    }

    /**
     * @internal
     */
    _setComponentsFromEditor({ components }: { components: ComponentsRecord }): void {
        // Turn off the proxy as this is already a validated message from the editor.
        this._proxy_state = "off";

        // The update message from the editor is guaranteed to contain only valid components
        // so we don't need to merge with the current values.
        for (const strKey in components) {
            const key = strKey as keyof ComponentsRecord;
            //@ts-expect-error: typescript doesn't like the assignment to this[key] as the attribute might be readonly,
            // even if we know it's not.
            this[key] = components[key];
        }
        this._proxy_state = "on";

        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     * @internal
     */
    _tryMarkingAsDirty({ component_type }: { component_type: ComponentName }): boolean {
        if (this._isInstantiated()) {
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
    _tryMarkingAsDeleted({ component_type }: { component_type: ComponentName }): boolean {
        if (this._isInstantiated()) {
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
    _onVisibilityChanged({ is_visible }: { is_visible: boolean }): void {
        this._is_visible = is_visible;
        this.dispatchEvent(new CustomEvent("visibility-changed", { detail: { is_visible } }));
    }

    /**
     * @internal
     */
    _addComponentDefaultValues({
        component_default_values,
    }: {
        component_default_values: ReadonlyMap<ComponentName, object>;
    }): void {
        this._proxy_state = "off";
        for (const [component_type, default_value] of component_default_values) {
            if (this[component_type]) {
                //@ts-expect-error: typescript doesn't like the assignment to this[component_type] as the attribute
                // might be readonly,
                this[component_type] = { ...structuredClone(default_value), ...this[component_type] };
            }
        }
        this._proxy_state = "on";
    }

    /**
     * @internal
     */
    _getComponentDefaultValue({ component_type }: { component_type: ComponentName }): object {
        return this._scene.entity_registry._getComponentDefaultValue({ component_type });
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
    /* eslint-disable */
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
                const component_type = prop as ComponentName;

                const Handler =
                    serializableComponentsProxies[component_type] ?? serializableComponentsProxies["default"];
                return new Proxy(entity[component_type]!, new Handler(entity, component_type));
            }

            return value;
        },

        set(entity: Entity, prop: PropertyKey, v: any): boolean {
            if (entity._proxy_state === "off") {
                return Reflect.set(entity, prop, v);
            }

            if (entity._isSerializableComponent(prop, v)) {
                //console.log("SET COMPONENT", prop, v);
                const defaultValue = entity._getComponentDefaultValue({
                    component_type: prop as ComponentName,
                });
                v = { ...structuredClone(defaultValue), ...v };
                entity._tryMarkingAsDirty({ component_type: prop as ComponentName });
            }

            return Reflect.set(entity, prop, v);
        },

        deleteProperty(entity: Entity, prop: PropertyKey): boolean {
            //@ts-ignore
            if (entity[prop] !== undefined) {
                //console.log("DELETE COMPONENT", prop);
                entity._tryMarkingAsDeleted({ component_type: prop as ComponentName });
            }

            return Reflect.deleteProperty(entity, prop);
        },
    };
    /* eslint-enable */
}
