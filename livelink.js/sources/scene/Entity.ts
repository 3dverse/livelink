//------------------------------------------------------------------------------
import type {
    ComponentsRecord,
    ComponentName,
    RTID,
    ScriptDataObject,
    UUID,
    Components,
    ComponentType,
    PartialComponentsRecord,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { EntityBase, type DefaultValue } from "../../_prebuild/EntityBase";

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
    private _auto_update: EntityAutoUpdateState = "on";

    /**
     *
     */
    private _auto_broadcast: EntityAutoUpdateState = "on";

    /**
     *
     */
    private __dirty_components = new Set<ComponentName>();

    /**
     *
     */
    private __deleted_components = new Set<ComponentName>();

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
        if (state === "off") {
            this._scene._entity_registry._removeEntityFromBroadcastList({ entity: this });
        }
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
    get _dirty_components(): Array<ComponentName> {
        return Array.from(this.__dirty_components);
    }

    /**
     * @internal
     */
    get _deleted_components(): Array<ComponentName> {
        return Array.from(this.__deleted_components);
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
        components: PartialComponentsRecord;
        dispatch_event?: boolean;
    }): void {
        for (const key in components) {
            const component_name = key as ComponentName;
            this.#unsafeSetComponentValue({ component_name, value: components[component_name] });
        }

        if (dispatch_event) {
            this.dispatchEvent(new CustomEvent("entity-updated"));
        }
    }

    /**
     * @internal
     */
    _markComponentAsDirty({ component_name }: { component_name: ComponentName }): void {
        this.__dirty_components.add(component_name);
        this._scene._entity_registry._addDirtyEntity({ entity: this });
        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     * @internal
     */
    _markComponentAsDeleted({ component_name }: { component_name: ComponentName }): void {
        this.__deleted_components.add(component_name);
        this._scene._entity_registry._addDirtyEntity({ entity: this });
        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     * @internal
     */
    _clearDirtyState(): void {
        this.__dirty_components.clear();
        this.__deleted_components.clear();
    }

    /**
     * @internal
     */
    _onVisibilityChanged({ is_visible }: { is_visible: boolean }): void {
        this._is_visible = is_visible;
        this.dispatchEvent(new CustomEvent("visibility-changed", { detail: { is_visible } }));
    }

    /**
     * FIXME: This is not used anywhere. Should we remove it?
     */
    toJSON(): Record<string, unknown> {
        console.log("Hellooooooooooooooooooo, I am hereeeeeeeeeeeeeee. I want to stay aliiiiiiiiiiiive");
        const serialized: Record<string, unknown> = {};
        for (const component_name of EntityBase.component_names) {
            const value = this[component_name];
            if (value !== undefined) {
                serialized[component_name] = value;
            }
        }
        return serialized;
    }

    /**
     * @internal
     */
    public _isSerializableComponent(prop: PropertyKey, v: unknown): boolean {
        return (
            typeof prop === "string" &&
            v !== undefined &&
            prop[0] !== "_" &&
            EntityBase.component_names.includes(prop as ComponentName)
        );
    }

    /**
     * Implementation of the EntityBase method.
     * Called by each component setters.
     *
     * @internal
     */
    protected _setComponentValue<_ComponentName extends ComponentName>({
        component_name,
        value,
    }: {
        component_name: _ComponentName;
        value: Partial<ComponentType<_ComponentName>> | DefaultValue | undefined;
    }): void {
        const is_component_attached = Reflect.has(this, `_${component_name}`);
        if (value === undefined) {
            if (!is_component_attached) {
                return;
            }

            Reflect.deleteProperty(this, `_${component_name}`);
            this._markComponentAsDeleted({ component_name });
            return;
        }

        if (value === "default") {
            value = undefined;
        }

        //FIXME: This will not patch euler orientation by using the LocalTransformHandler,
        // but we might want to get rid of it
        this.#unsafeSetComponentValue({ component_name, value });
        this._markComponentAsDirty({ component_name });
    }

    /**
     * Set the values of a component without marking it as dirty.
     */
    #unsafeSetComponentValue<_ComponentName extends ComponentName>({
        component_name,
        value,
    }: {
        component_name: _ComponentName;
        value: Partial<ComponentType<_ComponentName>> | undefined;
    }): void {
        const existing_component = Reflect.get(this, `#${component_name}_value`);
        if (existing_component) {
            Object.assign(existing_component, value);
            return;
        }

        this.#attachComponent({ component_name, value });
    }

    /**
     * Attach a component to the entity, by instantiating a proxy for it.
     * Proxy is used to mark the entity as dirty if the component attributes are modified.
     */
    #attachComponent<_ComponentName extends ComponentName>({
        component_name,
        value,
    }: {
        component_name: _ComponentName;
        value: Partial<ComponentType<_ComponentName>> | undefined;
    }): void {
        const Handler =
            Entity.serializableComponentsProxies[component_name] ?? Entity.serializableComponentsProxies["default"];

        const sanitized_value = this._scene._sanitizeComponentValue({ component_name, value });
        const proxy = new Proxy(sanitized_value, new Handler(this, component_name));

        Reflect.set(this, `#${component_name}_value`, sanitized_value);
        Reflect.set(this, `#${component_name}`, proxy);
    }

    /**
     * @internal
     */
    static serializableComponentsProxies = {
        ["local_transform"]: LocalTransformHandler,
        ["default"]: ComponentHandler,
    } as ComponentHandlers;
}
