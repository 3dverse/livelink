import type { ComponentName } from "@3dverse/livelink.core";
import { EditionEvent } from "../EditionEvent";
import { Client } from "../session/Client";

/**
 * The event that is fired when an entity is updated, either by adding, modifying or removing
 * components.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class EntityUpdatedEvent extends EditionEvent {
    /**
     * @deprecated
     *
     * Use {@link EditionEvent.isLocal} and {@link EditionEvent.isExternal} instead.
     *
     * The source of the change.
     * - "external": The change was made by another user from another instance of the app or even another app.
     * - "internal": The change was made by the current app.
     */
    public readonly change_source: "local" | "external";

    /**
     * The names of the components that were added.
     */
    public readonly new_components: Array<ComponentName>;

    /**
     * The names of the components that were updated.
     */
    public readonly updated_components: Array<ComponentName>;

    /**
     * The names of the components that were removed.
     */
    public readonly deleted_components: Array<ComponentName>;

    /**
     *
     */
    isAnyComponentDirty({ components }: { components: Array<ComponentName> }): boolean {
        return (
            this.new_components.some(component => components.includes(component)) ||
            this.updated_components.some(component => components.includes(component)) ||
            this.deleted_components.some(component => components.includes(component))
        );
    }

    /**
     * @internal
     */
    constructor({
        emitter,
        new_components,
        updated_components,
        deleted_components,
    }: {
        emitter: Client | null;
        new_components: Array<ComponentName>;
        updated_components: Array<ComponentName>;
        deleted_components: Array<ComponentName>;
    }) {
        super("on-entity-updated", emitter);
        this.change_source = emitter ? "external" : "local";
        this.new_components = new_components;
        this.updated_components = updated_components;
        this.deleted_components = deleted_components;
    }

    /**
     * Checks if the event includes any of the specified components, whether they were added, updated or removed.
     */
    includes(...components: ComponentName[]): boolean {
        return components.some(
            component =>
                this.new_components.includes(component) ||
                this.updated_components.includes(component) ||
                this.deleted_components.includes(component),
        );
    }
}

/**
 * The event that is fired when the entity visibility changes.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class EntityVisibilityChangedEvent extends Event {
    /**
     * The source of the change.
     * - "external": The visibility change was made by another user from another instance of the app or even another app.
     * - "internal": The visibility change was made by the current app.
     */
    public readonly change_source: "local" | "external";

    /**
     * The new visibility state of the entity.
     */
    public readonly is_visible: boolean;

    /**
     * @internal
     */
    constructor({ change_source, is_visible }: { change_source: "local" | "external"; is_visible: boolean }) {
        super("on-entity-visibility-changed");
        this.change_source = change_source;
        this.is_visible = is_visible;
    }
}

/**
 * @event
 * @category Scene
 */
export type EntityEvents = {
    "on-entity-updated": EntityUpdatedEvent;
    "on-entity-visibility-changed": EntityVisibilityChangedEvent;
};
