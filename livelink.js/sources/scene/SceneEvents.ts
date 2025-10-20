import { EditionEvent } from "../EditionEvent";
import type { Client } from "../session/Client";
import type { Entity } from "./Entity";
import type { RTID } from "@3dverse/livelink.core";

/**
 * Event that is fired when one or more entities are created.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class EntitiesCreatedEvent extends EditionEvent {
    /**
     * The entities that were created.
     */
    public readonly entities: Array<Entity>;

    /**
     * @internal
     */
    constructor({ entities, emitter }: { entities: Array<Entity>; emitter: Client | null }) {
        super("on-entities-created", emitter);
        this.entities = entities;
    }
}

/**
 * Event that is fired when one or more entities are deleted.
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
 * @event
 * @category Scene
 */
export type SceneEvents = {
    "on-entities-created": EntitiesCreatedEvent;
    "on-entities-deleted": EntitiesDeletedEvent;
};
