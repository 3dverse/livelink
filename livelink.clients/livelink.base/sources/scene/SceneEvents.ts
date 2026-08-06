import { EditionEvent } from "../EditionEvent";
import type { Client } from "../session/Client";
import type { Entity } from "./Entity";
import type { RTID, SceneSettingsManifest } from "@3dverse/livelink.core";

/**
 * Event that is fired when one or more entities are created.
 *
 * Dispatched by {@link Scene} as `on-entities-created`.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class EntitiesCreatedEvent<EntityType extends Entity = Entity> extends EditionEvent {
    /**
     * The entities that were created.
     */
    public readonly entities: Array<EntityType>;

    /**
     * @internal
     */
    constructor({ entities, emitter }: { entities: Array<EntityType>; emitter: Client | null }) {
        super("on-entities-created", emitter);
        this.entities = entities;
    }
}

/**
 * Event that is fired when one or more entities are deleted.
 *
 * Dispatched by {@link Scene} as `on-entities-deleted`.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class EntitiesDeletedEvent extends EditionEvent {
    /**
     * @internal
     */
    public readonly entity_ids: Array<RTID>;

    /**
     * Checks if the event includes the given entity.
     */
    includes(entity: Entity): boolean {
        return this.entity_ids.includes(entity.rtid);
    }

    /**
     * @internal
     */
    constructor({ entity_ids, emitter }: { entity_ids: Array<RTID>; emitter: Client | null }) {
        super("on-entities-deleted", emitter);
        this.entity_ids = entity_ids;
    }
}

/**
 * Event that is fired when the scene settings are updated.
 *
 * Dispatched by {@link Scene} as `on-scene-settings-updated`.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class SceneSettingsUpdatedEvent extends EditionEvent {
    /**
     * The updated scene settings that has been applied.
     * Contains only the settings that were changed.
     */
    public readonly updated_settings: SceneSettingsManifest;

    /**
     * @internal
     */
    constructor({ updated_settings, emitter }: { updated_settings: SceneSettingsManifest; emitter: Client | null }) {
        super("on-scene-settings-updated", emitter);
        this.updated_settings = updated_settings;
    }
}

/**
 * The events dispatched by {@link Scene}.
 *
 * @event
 * @category Scene
 */
export type SceneEvents<EntityType extends Entity = Entity> = {
    "on-entities-created": EntitiesCreatedEvent<EntityType>;
    "on-entities-deleted": EntitiesDeletedEvent;
    "on-scene-settings-updated": SceneSettingsUpdatedEvent;
};
