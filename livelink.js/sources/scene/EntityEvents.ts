import { ComponentName } from "@3dverse/livelink.core";

/**
 * The event that is fired when an entity is updated, either by adding, modifying or removing
 * components.
 *
 * @event
 * @category Scene
 */
export class EntityUpdatedEvent extends Event {
    /**
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
        change_source,
        new_components,
        updated_components,
        deleted_components,
    }: {
        change_source: "local" | "external";
        new_components: Array<ComponentName>;
        updated_components: Array<ComponentName>;
        deleted_components: Array<ComponentName>;
    }) {
        super("on-entity-updated");
        this.change_source = change_source;
        this.new_components = new_components;
        this.updated_components = updated_components;
        this.deleted_components = deleted_components;
    }
}

/**
 * The event that is fired when the entity visibility changes.
 *
 * @event
 * @category Scene
 */
export class EntityVisibilityChangedEvent extends Event {
    /**
     * The new visibility state of the entity.
     */
    public readonly is_visible: boolean;

    /**
     * @internal
     */
    constructor({ is_visible }: { is_visible: boolean }) {
        super("on-entity-visibility-changed");
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
