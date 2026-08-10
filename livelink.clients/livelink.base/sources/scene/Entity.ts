//------------------------------------------------------------------------------
import type {
    ComponentName,
    RTID,
    UUID,
    ComponentType,
    EntityCore,
    ComponentsManifest,
    ComponentsRecord,
    ScriptDataObject,
    Events,
    Quat,
    Vec3,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { EntityComponents, type DefaultValue } from "../../_prebuild/EntityComponents";

//------------------------------------------------------------------------------
import type { EntityCreationOptions, SceneEntityInterface } from "./Scene";
import { EntityUpdatedEvent, EntityVisibilityChangedEvent } from "./EntityEvents";
import { ScriptEventEmitted, ScriptEventReceived, ScriptEvents } from "./ScriptEvents";
import { TypedEventTarget } from "../TypedEventTarget";
import { quaternionFromEuler, quaternionToEuler } from "../maths";

/**
 * An entity in a scene.
 *
 * An entity is a collection of components.
 *
 * Components are accessed through explicit methods: getComponent() returns the current value of a component, while
 * updateComponent() and updateComponents() mark the component as dirty and send its current value to the server on the
 * next update. The deleteComponent() method marks the component as deleted and sends this information to the server.
 *
 * All relevant modifications to entities are batched and automatically sent to the server and
 * broadcasted to other clients if the `auto_broadcast` property is set to "on".
 *
 * On top of providing direct access to the components, this class provides helper methods to
 * retrieve the parent entity and the children entities.
 *
 * This class cannot be instantiated directly.
 * Use the {@link SceneBase.newEntity} or {@link SceneBase.newEntities} methods on an existing scene to
 * create an entity.
 *
 * @category Scene
 */
export class Entity extends EntityComponents {
    /**
     *
     */
    readonly #scene: SceneEntityInterface;

    /**
     *
     */
    readonly #dirty_components = new Set<ComponentName>();

    /**
     *
     */
    readonly #deleted_components = new Set<ComponentName>();

    /**
     * Last-known-synchronized rotation pair of the `local_transform` component, stored as value
     * copies (never references into the live component). Used by the mutate-then-flag path to
     * detect which rotation representation the caller mutated, so the other one can be recomputed
     * (see {@link Entity.updateComponent}).
     */
    #rotation_shadow: { orientation: Quat; eulerOrientation: Vec3 } | null = null;

    /**
     *
     */
    readonly #script_event_received_event_target = new TypedEventTarget<ScriptEvents<ScriptEventReceived>>();

    /**
     *
     */
    readonly #script_event_emitted_event_target = new TypedEventTarget<ScriptEvents<ScriptEventEmitted>>();

    /**
     * @deprecated
     */
    #auto_broadcast: boolean = true;

    /**
     *
     */
    #is_visible: boolean = true;

    /**
     *
     */
    #children_rtid: Array<RTID> = [];

    /**
     *
     */
    #parent: Entity | null = null;

    /**
     * @internal
     */
    get children_rtid(): Array<RTID> {
        return this.#children_rtid;
    }

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
        this._dispatchEvent(new EntityVisibilityChangedEvent({ is_visible, change_source: "local" }));
    }

    /**
     * The parent entity of this entity or null if it has no parent.
     */
    get parent(): Entity | null {
        return this.#parent;
    }

    /**
     * Re-parent the entity by setting a parent entity.
     */
    set parent(parent: Entity | null) {
        if (parent) {
            let current: Entity | null = parent;
            while (current) {
                if (current === this) {
                    throw new Error("Cannot reparent an entity to itself or one of its children");
                }
                current = current.parent;
            }
        }

        this._set_parent(parent);
        const lineage = this.lineage;
        this.updateComponent("lineage", {
            parentUUID: parent ? parent.id : "00000000-0000-0000-0000-000000000000",
            value: lineage?.value ?? [],
        });
        this.#scene._onEntityReparented();
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
        super({ euid: components.euid });

        this.#parent = parent;
        this.#scene = scene;
        this.#is_visible = is_visible;
        this.#children_rtid = children_rtid;
        // Call the private (non-virtual) applier so subclasses don't run overridden hooks before
        // their own fields are initialized.
        this.#applyComponents({ components });
        this.#scene._entity_registry.add({ entity: this });

        if (!options) {
            return;
        }

        if (options.auto_broadcast !== undefined) {
            this.auto_broadcast = options.auto_broadcast;
        }
    }

    /**
     * Returns the children of this entity.
     */
    async getChildren(): Promise<Entity[]> {
        return await this.#scene._getChildren({ entity: this });
    }

    /**
     * Add an event listener for a script event.
     * Script events are triggered by the server when a script attached to an entity emits an event.
     *
     * @param params
     * @param params.event_map_id - The ID of the event map.
     * @param params.event_name - The name of the event.
     * @param params.onReceived - The callback to be called when the current entity is targetted by the script event.
     * @param params.onEmitted - The callback to be called when the current entity emits the script event.
     */
    addScriptEventListener({
        event_map_id,
        event_name,
        onReceived,
        onEmitted,
    }: {
        event_map_id: UUID;
        event_name: string;
        onReceived?: (evt: ScriptEventReceived) => void;
        onEmitted?: (evt: ScriptEventEmitted) => void;
    }): void {
        if (onReceived) {
            this.#script_event_received_event_target.addEventListener(event_map_id + "/" + event_name, onReceived);
        }

        if (onEmitted) {
            this.#script_event_emitted_event_target.addEventListener(event_map_id + "/" + event_name, onEmitted);
        }
    }

    /**
     * Remove an event listener for a script event.
     *
     * @param params
     * @param params.event_map_id - The ID of the event map.
     * @param params.event_name - The name of the event.
     * @param params.onReceived - A previously registered callback.
     * @param params.onEmitted - A previously registered callback.
     */
    removeScriptEventListener({
        event_map_id,
        event_name,
        onReceived,
        onEmitted,
    }: {
        event_map_id: UUID;
        event_name: string;
        onReceived?: (evt: ScriptEventReceived) => void;
        onEmitted?: (evt: ScriptEventEmitted) => void;
    }): void {
        if (onReceived) {
            this.#script_event_received_event_target.removeEventListener(event_map_id + "/" + event_name, onReceived);
        }

        if (onEmitted) {
            this.#script_event_emitted_event_target.removeEventListener(event_map_id + "/" + event_name, onEmitted);
        }
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
     * Get the live, mutable value of a component.
     * Returns undefined if the component doesn't exist on this entity.
     *
     * The returned object is the actual stored value: it may be mutated in place, but such mutations
     * are not auto-detected. Flag them explicitly with {@link Entity.updateComponent} /
     * {@link Entity.updateComponents}.
     *
     * @example
     * ```typescript
     * const transform = entity.getComponent('local_transform');
     * if (transform) {
     *     console.log(transform.position);
     * }
     * ```
     */
    public getComponent<_ComponentName extends ComponentName>(
        component_name: _ComponentName,
    ): ComponentType<_ComponentName> | undefined {
        return this._unsafeGetComponentValue({ component_name });
    }

    /**
     * Flag a component as dirty so its current value is sent to the server on the next update.
     *
     * If a `value` is provided, it is applied first (partial update, creating the component if
     * needed; `"default"` resets to default values). If `value` is omitted, the component's current
     * stored value is flagged as-is — the intended pattern is to mutate the object returned by a
     * getter, then call this to flag it.
     *
     * Flagging `local_transform` re-synchronizes its two rotation representations: the
     * representation the caller mutated (`orientation` or `eulerOrientation`) is detected and the
     * other one is recomputed from it. When both were mutated, they are trusted as-is, like on the
     * value-patch path.
     *
     * @example
     * ```typescript
     * // Mutate-then-flag
     * entity.local_transform!.position[1] = 1;
     * entity.updateComponent('local_transform');
     *
     * // Apply a partial update and flag in one call
     * entity.updateComponent('local_transform', { position: [0, 1, 0] });
     *
     * // Reset to defaults
     * entity.updateComponent('mesh_ref', 'default');
     * ```
     */
    public updateComponent<_ComponentName extends ComponentName>(
        component_name: _ComponentName,
        value?: Partial<ComponentType<_ComponentName>> | DefaultValue,
    ): void {
        if (value === undefined) {
            // Mutate-then-flag: flag the current stored value, if any.
            if (this._unsafeGetComponentValue({ component_name }) === undefined) {
                return;
            }
            if (component_name === "local_transform") {
                this.#resyncLocalTransformRotation();
            }
            this._markComponentAsDirty({ component_name, is_new: false });
            return;
        }

        let processed_value: Partial<ComponentType<_ComponentName>> =
            value === "default" ? this.#scene._sanitizeComponentValue({ component_name, value: undefined }) : value;

        if (component_name === "local_transform") {
            processed_value = normalizeLocalTransformPatch(processed_value as LocalTransformPatch) as Partial<
                ComponentType<_ComponentName>
            >;
        }

        const existing_component = this._unsafeGetComponentValue({ component_name });
        const isNewComponent = existing_component === undefined;

        if (existing_component !== undefined) {
            // Update existing component
            assignComponentPatchInPlace(existing_component, processed_value);
        } else {
            // Create new component
            const sanitized_value = this.#scene._sanitizeComponentValue({
                component_name,
                value: processed_value,
            });
            this._unsafeSetComponentValue({ component_name, value: sanitized_value });
        }

        // Mark as dirty and dispatch event
        this._markComponentAsDirty({ component_name, is_new: isNewComponent });
    }

    /**
     * Flag several components as dirty at once, using their current stored values.
     *
     * @param component_names - The components to flag.
     *
     * @example
     * ```typescript
     * entity.local_transform!.position[1] = 1;
     * entity.debug_name!.value = "renamed";
     * entity.updateComponents(["local_transform", "debug_name"]);
     *
     * ```
     */
    public updateComponents(component_names: Array<ComponentName>): void {
        for (const component_name of component_names) {
            this.updateComponent(component_name);
        }
    }

    /**
     * Delete a component from the entity.
     * If the component doesn't exist, this is a no-op.
     *
     * @example
     * ```typescript
     * entity.deleteComponent('mesh_renderer');
     * ```
     */
    public deleteComponent(component_name: ComponentName): void {
        const existing_component = this._unsafeGetComponentValue({ component_name });
        if (existing_component === undefined) {
            return;
        }

        this._unsafeSetComponentValue({ component_name, value: undefined });
        if (component_name === "local_transform") {
            this.#rotation_shadow = null;
        }
        this._markComponentAsDeleted({ component_name });
    }

    /**
     * @internal
     *
     * Re-copy the stored `local_transform` rotation pair into the shadow used by the
     * mutate-then-flag direction detection (see {@link Entity.updateComponent}). Called after every
     * code path that establishes a synchronized quaternion/euler pair. Protected so subclasses
     * writing the stored value directly (the browser entity's constructor and
     * `_setLocalTransform`) can keep the shadow fresh.
     */
    protected _refreshLocalTransformShadow(): void {
        const local_transform = this._unsafeGetComponentValue({ component_name: "local_transform" });
        if (local_transform === undefined) {
            this.#rotation_shadow = null;
            return;
        }

        this.#rotation_shadow = {
            orientation: [...local_transform.orientation] as Quat,
            eulerOrientation: [...local_transform.eulerOrientation] as Vec3,
        };
    }

    /**
     * Re-synchronize the quaternion / euler representations of the stored `local_transform` after
     * caller-side mutations (the mutate-then-flag path). The shadow tells which representation the
     * caller mutated: that one is authoritative and the other is recomputed from it. When both (or
     * neither) changed, the stored values are trusted as-is — the same policy as the value-patch
     * path (see {@link normalizeLocalTransformPatch}). Recomputed values are written element-wise
     * in place so the array references captured by the browser transform proxies stay live.
     */
    #resyncLocalTransformRotation(): void {
        const local_transform = this._unsafeGetComponentValue({ component_name: "local_transform" });
        if (local_transform === undefined) {
            this.#rotation_shadow = null;
            return;
        }

        const shadow = this.#rotation_shadow;
        if (shadow !== null) {
            const orientation_changed = !areArraysEqual(local_transform.orientation, shadow.orientation);
            const euler_changed = !areArraysEqual(local_transform.eulerOrientation, shadow.eulerOrientation);

            if (orientation_changed && !euler_changed) {
                copyArrayInPlace(local_transform.eulerOrientation, quaternionToEuler(local_transform.orientation));
            } else if (euler_changed && !orientation_changed) {
                copyArrayInPlace(local_transform.orientation, quaternionFromEuler(local_transform.eulerOrientation));
            }
        }

        this._refreshLocalTransformShadow();
    }

    /**
     * @internal
     */
    protected _setComponentValue<_ComponentName extends ComponentName>({
        component_name,
        value,
    }: {
        component_name: _ComponentName;
        value?: Partial<ComponentType<_ComponentName>> | DefaultValue;
    }): void {
        if (value === undefined) {
            this.deleteComponent(component_name);
        } else {
            this.updateComponent(component_name, value);
        }
    }

    /**
     * @internal
     */
    _set_parent(parent: Entity | null): void {
        this.#parent = parent;
    }

    /**
     * @internal
     */
    _applyComponentsUpdate({
        components,
        deleted_components = [],
        dispatch_event,
        emitter,
    }: {
        components: EntityCore | ComponentsManifest | Partial<ComponentsRecord>;
        deleted_components?: Array<ComponentName>;
    } & (
        | { dispatch_event: false; emitter?: undefined }
        | { dispatch_event: true; emitter: Events.Emitter | null }
    )): void {
        this.#applyComponents({ components, deleted_components });

        if (dispatch_event) {
            this._dispatchEvent(
                new EntityUpdatedEvent({
                    emitter: this.#scene._resolveEmitter(emitter),
                    updated_components: Object.keys(components) as Array<ComponentName>,
                    deleted_components,
                    new_components: [],
                }),
            );
        }
    }

    /**
     * Apply component values to the storage core without marking anything dirty or dispatching an
     * event. Private (non-virtual) so it is safe to call from the constructor.
     */
    #applyComponents({
        components,
        deleted_components = [],
    }: {
        components: EntityCore | ComponentsManifest | Partial<ComponentsRecord>;
        deleted_components?: Array<ComponentName>;
    }): void {
        for (const key in components) {
            const component_name = key as ComponentName | "euid";

            switch (component_name) {
                case "euid":
                    break;
                default: {
                    // Apply component value without marking as dirty
                    const existing = this._unsafeGetComponentValue({ component_name });
                    if (existing !== undefined) {
                        Object.assign(existing, components[component_name]);
                    } else {
                        const sanitized = this.#scene._sanitizeComponentValue({
                            component_name,
                            value: components[component_name],
                        });
                        this._unsafeSetComponentValue({ component_name, value: sanitized });
                    }
                    break;
                }
            }
        }

        for (const component_name of deleted_components) {
            this.#unsafeDeleteComponent({ component_name });
        }

        if ("local_transform" in components || deleted_components.includes("local_transform")) {
            this._refreshLocalTransformShadow();
        }
    }

    /**
     * @internal
     */
    _markComponentAsDirty({ component_name, is_new }: { component_name: ComponentName; is_new?: boolean }): void {
        if (component_name === "local_transform") {
            // Keep the mutate-then-flag shadow fresh after every path that establishes a
            // synchronized rotation pair and flags dirty: the value-patch path and the browser
            // transform-proxy writes.
            this._refreshLocalTransformShadow();
        }
        this.#dirty_components.add(component_name);
        this.#scene._entity_registry._addDirtyEntity({ entity: this });
        if (is_new === undefined) {
            is_new = this._unsafeGetComponentValue({ component_name }) === undefined;
        }
        this._dispatchEvent(
            new EntityUpdatedEvent({
                emitter: null,
                updated_components: !is_new ? [component_name] : [],
                deleted_components: [],
                new_components: is_new ? [component_name] : [],
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
                emitter: null,
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
        this._dispatchEvent(new EntityVisibilityChangedEvent({ is_visible, change_source: "external" }));
    }

    /**
     * @internal
     */
    _onScriptEventEmitted({
        event_name,
        target_rtids,
        data_object,
    }: {
        event_name: string;
        target_rtids: Array<RTID>;
        data_object: ScriptDataObject;
    }): void {
        this.#script_event_emitted_event_target._dispatchEvent(
            new ScriptEventEmitted({
                scene: this.#scene,
                event_name,
                emitter_entity: this,
                target_rtids,
                data_object,
            }),
        );
    }

    /**
     * @internal
     */
    _onScriptEventReceived({
        script_event_received_event,
    }: {
        script_event_received_event: ScriptEventReceived;
    }): void {
        this.#script_event_received_event_target._dispatchEvent(script_event_received_event);
    }

    /**
     *
     */
    #unsafeDeleteComponent<_ComponentName extends ComponentName>({
        component_name,
    }: {
        component_name: _ComponentName;
    }): void {
        this._unsafeSetComponentValue({ component_name, value: undefined });
    }
}

/**
 * The subset of a `local_transform` patch that carries a rotation, in either representation.
 */
type LocalTransformPatch = {
    orientation?: Quat;
    eulerOrientation?: Vec3;
};

/**
 * Keep the quaternion `orientation` and its `eulerOrientation` counterpart in sync in a
 * `local_transform` patch.
 *
 * When a patch sets only one of the two representations, the other is recomputed so the merged
 * component stays consistent. When it sets both, the caller's values are trusted as-is.
 */
function normalizeLocalTransformPatch<T extends LocalTransformPatch>(patch: T): T {
    const has_orientation = patch.orientation !== undefined;
    const has_euler = patch.eulerOrientation !== undefined;

    if (has_orientation && !has_euler) {
        return { ...patch, eulerOrientation: quaternionToEuler(patch.orientation as Quat) };
    }
    if (has_euler && !has_orientation) {
        return { ...patch, orientation: quaternionFromEuler(patch.eulerOrientation as Vec3) };
    }
    return patch;
}

/**
 * Merge a component patch into the stored component value, preserving object identity.
 *
 * Unlike `Object.assign`, array values are copied element-wise into the existing arrays instead of
 * replacing them. This is a contract of the explicit component model, not an optimization: a handle
 * obtained from {@link Entity.getComponent} (and any nested array pulled off it) must keep reading
 * and writing the live values across patch merges, or the documented mutate-then-flag pattern would
 * silently operate on stale objects. The browser SDK's transform proxies are one consumer of this
 * contract — they capture the component's arrays at construction time.
 */
function assignComponentPatchInPlace(existing: object, patch: object): void {
    const target = existing as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
        const current = target[key];
        if (Array.isArray(current) && Array.isArray(value)) {
            current.length = value.length;
            for (let i = 0; i < value.length; i++) {
                current[i] = value[i];
            }
        } else {
            target[key] = value;
        }
    }
}

/**
 * Exact element-wise equality. Used by the mutate-then-flag rotation shadow: the shadow holds exact
 * copies of the last-synchronized values, so any caller mutation differs exactly — no epsilon
 * needed.
 */
function areArraysEqual(a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Copy values into an existing array without replacing it, so references captured elsewhere (the
 * browser SDK's transform proxies) keep reading and writing the live values.
 */
function copyArrayInPlace(target: Array<number>, values: ReadonlyArray<number>): void {
    target.length = values.length;
    for (let i = 0; i < values.length; i++) {
        target[i] = values[i];
    }
}
