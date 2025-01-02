//------------------------------------------------------------------------------
import type { ComponentsRecord, ComponentName, RTID, ScriptDataObject, UUID, Components } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { EntityBase } from "../../_prebuild/EntityBase";

//------------------------------------------------------------------------------
import { EntityCreationOptions, Scene } from "./Scene";
import { ComponentHandler, ComponentHandlers, LocalTransformHandler } from "./ComponentHandler";

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
 * On top of providing direct access to the components, this class provides helper methods to
 * retrieve the parent entity and the children entities.
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
    private _parent: Entity | null = null;

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
        this._scene._setEntityVisibility({ entity_rtid: this.rtid, is_visible });
        this._is_visible = is_visible;
    }

    /**
     * The parent entity of this entity or null if it has no parent.
     */
    get parent(): Entity | null {
        return this._parent;
    }

    /**
     *
     */
    set parent(parent: Entity | null) {
        throw new Error("Not implemented");
    }

    /**
     * @internal
     */
    constructor({
        scene,
        parent = null,
        components,
        options,
    }: {
        scene: Scene;
        parent: Entity | null;
        components: Partial<ComponentsRecord> & { euid: Components.Euid };
        options?: EntityCreationOptions;
    }) {
        super({ euid: components.euid });

        this._scene = scene;
        this._parent = parent;
        this._mergeComponents({ components, dispatch_event: false });

        for (const key in this) {
            if (this[key] === undefined) {
                delete this[key];
            }
        }

        this._proxy_state = options?.disable_proxy === true ? "off" : "on";

        if (!options) {
            return;
        }

        if (options.auto_broadcast !== undefined) {
            this.auto_broadcast = options.auto_broadcast ? "on" : "off";
        }

        if (options.auto_update !== undefined) {
            this.auto_update = options.auto_update ? "on" : "off";
        }
    }

    /**
     *
     */
    async getChildren(): Promise<Entity[]> {
        return await this._scene._getChildren({ entity: this });
    }

    /**
     * @experimental
     */
    async assignClientToScripts({ client_uuid }: { client_uuid: UUID }): Promise<void> {
        if (!this.script_map || !this.script_map.elements) {
            throw new Error("Entity has no scripts");
        }
        const script_ids = Object.keys(this.script_map.elements);
        await Promise.all(
            script_ids.map(script_id =>
                this._scene._assignClientToScripts({ client_uuid, entity_rtid: this.rtid, script_uuid: script_id }),
            ),
        );
    }

    /**
     * @internal
     * @experimental
     */
    _onScriptEventTarget({
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
    _onScriptEventEmitter({
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
    _mergeComponents({
        components,
        dispatch_event = true,
    }: {
        components: Partial<ComponentsRecord>;
        dispatch_event?: boolean;
    }): void {
        const actual_proxy_state = this._proxy_state;
        this._proxy_state = "off";

        for (const key in components) {
            const component_name = key as ComponentName;
            //@ts-expect-error: typescript doesn't like the assignment to this[key] as the attribute might be readonly,
            // even if we know it's not.
            this[component_name] = { ...this[component_name], ...components[component_name] };
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
        const actual_proxy_state = this._proxy_state;
        this._proxy_state = "off";

        // The update message from the editor is guaranteed to contain only valid components
        // so we don't need to merge with the current values.
        for (const key in components) {
            const component_name = key as ComponentName;
            //@ts-expect-error: typescript doesn't like the assignment to this[component_name] as the attribute might
            // be readonly, but we know it's not.
            this[component_name] = components[component_name];
        }
        this._proxy_state = actual_proxy_state;

        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     * @internal
     */
    _markComponentAsDirty({ component_type }: { component_type: ComponentName }): void {
        this._scene._entity_registry._addEntityToUpdate({ component_type, entity: this });
        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     * @internal
     */
    _markComponentAsDeleted({ component_type }: { component_type: ComponentName }): void {
        this._scene._entity_registry._detachComponentFromEntity({ component_type, entity: this });
        this.dispatchEvent(new CustomEvent("entity-updated"));
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
                entity._markComponentAsDirty({ component_type: prop as ComponentName });
            }

            return Reflect.set(entity, prop, v);
        },

        deleteProperty(entity: Entity, prop: PropertyKey): boolean {
            //@ts-ignore
            if (entity[prop] !== undefined) {
                //console.log("DELETE COMPONENT", prop);
                entity._markComponentAsDeleted({ component_type: prop as ComponentName });
            }

            return Reflect.deleteProperty(entity, prop);
        },
    };
    /* eslint-enable */
}
