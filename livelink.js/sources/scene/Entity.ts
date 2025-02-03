//------------------------------------------------------------------------------
import type {
    ComponentName,
    RTID,
    UUID,
    ComponentType,
    EntityCore,
    ComponentsManifest,
    ComponentsRecord,
    Mat4,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { type DefaultValue } from "../../_prebuild/EntityBase";

//------------------------------------------------------------------------------
import { EntityCreationOptions, Scene } from "./Scene";
import { EntityTransformHandler, Transform } from "./EntityTransformHandler";
import { ComponentHandler } from "./ComponentHandler";
import { EntityUpdatedEvent, EntityVisibilityChangedEvent } from "./EntityEvents";

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
export class Entity extends EntityTransformHandler {
    /**
     *
     */
    readonly #scene: Scene;

    /**
     *
     */
    readonly #dirty_components = new Set<ComponentName>();

    /**
     *
     */
    readonly #deleted_components = new Set<ComponentName>();

    /**
     * @deprecated
     */
    #auto_update: boolean = true;

    /**
     * @deprecated
     */
    #auto_broadcast: boolean = true;

    /**
     *
     */
    #is_visible: boolean = true;

    /**
     * @internal
     */
    get rtid(): RTID {
        return this.euid.rtid;
    }

    /**
     * The UUID of the entity.
     *
     * Note that multiple entities can share the same UUID if they are different instances of the
     * same entity brought by multiple instances of the same scene.
     */
    get id(): UUID {
        return this.euid.value;
    }

    /**
     * The name of the entity.
     */
    get name(): string {
        return this.debug_name?.value ?? "<unnamed>";
    }

    /**
     * @deprecated
     * Whether the entity has its components updates sent to the server.
     */
    get auto_update(): boolean {
        return this.#auto_update;
    }

    /**
     * @deprecated
     * Set whether the entity has its components updates sent to the server.
     */
    set auto_update(state: boolean) {
        this.#auto_update = state;
    }

    /**
     * @deprecated
     * Whether the entity has its components updates broadcasted to other clients.
     */
    get auto_broadcast(): boolean {
        return this.#auto_broadcast;
    }

    /**
     * @deprecated
     * Set whether the entity has its components updates broadcasted to other clients.
     */
    set auto_broadcast(state: boolean) {
        this.#auto_broadcast = state;
        if (state === false) {
            this.#scene._entity_registry._removeEntityFromBroadcastList({ entity: this });
        }
    }

    /**
     * Whether the entity is visible.
     */
    get is_visible(): boolean {
        return this.#is_visible;
    }

    /**
     * Set whether the entity is visible.
     */
    set is_visible(is_visible: boolean) {
        this.#scene._setEntityVisibility({ entity_rtid: this.rtid, is_visible });
        this.#is_visible = is_visible;
    }

    /**
     * The parent entity of this entity or null if it has no parent.
     */
    get parent(): Entity | null {
        return super.parent as Entity | null;
    }

    /**
     * Re-parent the entity by setting a parent entity.
     */
    set parent(parent: Entity | null) {
        super.parent = parent;
    }

    /**
     * Local transform of the entity.
     */
    get local_transform(): Transform {
        return super.local_transform;
    }

    /**
     * Set the local transform of the entity.
     */
    set local_transform(local_transform: Partial<Transform>) {
        super.local_transform = local_transform;
    }

    /**
     * Global transform of the entity.
     */
    get global_transform(): Transform {
        return super.global_transform;
    }

    /**
     * Set the global transform of the entity.
     */
    set global_transform(global_transform: Partial<Transform>) {
        super.global_transform = global_transform;
    }

    /**
     * The local space to world space matrix of the entity.
     */
    get ls_to_ws(): Mat4 {
        return super.ls_to_ws;
    }

    /**
     * The world space to local space matrix of the entity.
     */
    get ws_to_ls(): Mat4 {
        return super.ws_to_ls;
    }

    /**
     * @internal
     */
    get _dirty_components(): Array<ComponentName> {
        return Array.from(this.#dirty_components);
    }

    /**
     * @internal
     */
    get _deleted_components(): Array<ComponentName> {
        return Array.from(this.#deleted_components);
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
        components: EntityCore;
        options?: EntityCreationOptions;
    }) {
        super({
            euid: components.euid,
            parent,
            local_transform: scene._sanitizeComponentValue({
                component_name: "local_transform",
                value: components.local_transform,
            }),
        });

        this.#scene = scene;
        this._mergeComponents({ components, dispatch_event: false });
        this.#scene._entity_registry.add({ entity: this });

        if (!options) {
            return;
        }

        if (options.auto_broadcast !== undefined) {
            this.auto_broadcast = options.auto_broadcast;
        }

        if (options.auto_update !== undefined) {
            this.auto_update = options.auto_update;
        }
    }

    /**
     *
     */
    async getChildren(): Promise<Entity[]> {
        return await this.#scene._getChildren({ entity: this });
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
                this.#scene._assignClientToScripts({ client_uuid, entity_rtid: this.rtid, script_uuid: script_id }),
            ),
        );
    }
    /**
     * @internal
     */
    _mergeComponents({
        components,
        dispatch_event,
        change_source,
    }: { components: EntityCore | ComponentsManifest | Partial<ComponentsRecord> } & (
        | { dispatch_event: false; change_source?: undefined }
        | { dispatch_event: true; change_source: "local" | "external" }
    )): void {
        for (const key in components) {
            const component_name = key as ComponentName | "euid";

            switch (component_name) {
                case "euid":
                    break;
                case "local_transform":
                    this._setLocalTransform({ local_transform: components[component_name]! });
                    break;
                default:
                    this.#unsafeSetComponentValue({ component_name, value: components[component_name] });
                    break;
            }
        }

        if (dispatch_event) {
            this._dispatchEvent(
                new EntityUpdatedEvent({
                    change_source,
                    updated_components: Object.keys(components) as Array<ComponentName>,
                    deleted_components: [],
                    new_components: [],
                }),
            );
        }
    }

    /**
     * @internal
     */
    _markComponentAsDirty({ component_name }: { component_name: ComponentName }): void {
        this.#dirty_components.add(component_name);
        this.#scene._entity_registry._addDirtyEntity({ entity: this });
        const isNewComponent = this[component_name] === undefined;
        this._dispatchEvent(
            new EntityUpdatedEvent({
                change_source: "local",
                updated_components: !isNewComponent ? [component_name] : [],
                deleted_components: [],
                new_components: isNewComponent ? [component_name] : [],
            }),
        );
    }

    /**
     * @internal
     */
    _markComponentAsDeleted({ component_name }: { component_name: ComponentName }): void {
        this.#deleted_components.add(component_name);
        this.#scene._entity_registry._addDirtyEntity({ entity: this });
        this._dispatchEvent(
            new EntityUpdatedEvent({
                change_source: "local",
                updated_components: [],
                deleted_components: [component_name],
                new_components: [],
            }),
        );
    }

    /**
     * @internal
     */
    _clearDirtyState(): void {
        this.#dirty_components.clear();
        this.#deleted_components.clear();
    }

    /**
     * @internal
     */
    _onVisibilityChanged({ is_visible }: { is_visible: boolean }): void {
        this.#is_visible = is_visible;
        this._dispatchEvent(new EntityVisibilityChangedEvent({ is_visible }));
    }

    /**
     * Implementation of the EntityBase method.
     * Called by each component setters.
     *
     * @internal
     */
    protected _setComponentValue<_ComponentName extends ComponentName>({
        ref,
        component_name,
        value,
    }: {
        ref: ComponentType<_ComponentName> | undefined;
        component_name: _ComponentName;
        value: Partial<ComponentType<_ComponentName>> | DefaultValue | undefined;
    }): ComponentType<_ComponentName> | undefined {
        if (value === undefined && ref === undefined) {
            return undefined;
        }

        if (value === undefined) {
            this._markComponentAsDeleted({ component_name });
            Reflect.deleteProperty(this, `#${component_name}`);
            return undefined;
        }

        if (value === "default") {
            // Setting the value to undefined will resolve to the default values
            value = this.#scene._sanitizeComponentValue({ component_name, value: undefined });
        }

        if (ref === undefined) {
            this._markComponentAsDirty({ component_name });
            return this.#createComponentProxy({ component_name, value });
        }

        if (ref !== undefined) {
            // Proxy will mark the entity as dirty if the component attributes are modified
            Object.assign(ref, value);
            return ref;
        }
    }

    /**
     *
     */
    #unsafeGetComponentValue<_ComponentName extends ComponentName>({
        component_name,
    }: {
        component_name: _ComponentName;
    }): ComponentType<_ComponentName> {
        return Reflect.get(this, `#${component_name}`) as ComponentType<_ComponentName>;
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
        const existing_component = this.#unsafeGetComponentValue({ component_name });
        if (existing_component) {
            Object.assign(existing_component, value);
            return;
        }

        const proxy = this.#createComponentProxy({ component_name, value });
        this._unsafeSetComponentValue({ component_name, value: proxy });
    }

    /**
     * Attach a component to the entity, by instantiating a proxy for it.
     * Proxy is used to mark the entity as dirty if the component attributes are modified.
     */
    #createComponentProxy<_ComponentName extends ComponentName>({
        component_name,
        value,
    }: {
        component_name: _ComponentName;
        value: Partial<ComponentType<_ComponentName>> | undefined;
    }): ComponentType<_ComponentName> {
        const sanitized_value = this.#scene._sanitizeComponentValue({ component_name, value });
        // Keep an accessible reference to the proxied component value
        Reflect.set(this, `#${component_name}`, sanitized_value);

        return new Proxy(sanitized_value, new ComponentHandler(this, component_name)) as ComponentType<_ComponentName>;
    }
}
