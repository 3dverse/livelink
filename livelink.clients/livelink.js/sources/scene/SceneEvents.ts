import type { Entity } from "./Entity";
import {
    EntitiesCreatedEvent as EntitiesCreatedEventBase,
    EntitiesDeletedEvent,
    SceneSettingsUpdatedEvent,
} from "@livelink.base/scene/SceneEvents";

/**
 * @internal
 *
 * The runtime class, unchanged: the shared base is what actually constructs and dispatches the
 * event, so re-exporting the very same value keeps `instanceof` working. Only the type below
 * differs, and the two merge into one public `EntitiesCreatedEvent` name.
 */
export const EntitiesCreatedEvent = EntitiesCreatedEventBase;
/**
 * Event that is fired when one or more entities are created.
 *
 * Dispatched by {@link Scene} as `on-entities-created`.
 *
 * The browser SDK resolves entities as its proxied {@link Entity}, so the shared entity-creation
 * event is re-exported here with its type parameter rebound to the browser Entity (the shared base
 * defaults it to the headless entity) — consumers can write `EntitiesCreatedEvent` and get the
 * browser Entity. Declared as an interface rather than a type alias so the payload it carries is
 * documented on the type consumers actually see.
 *
 * @event
 * @noInheritDoc
 * @category Scene / Events
 */
export interface EntitiesCreatedEvent<EntityType extends Entity = Entity> extends EntitiesCreatedEventBase<EntityType> {
    /**
     * The entities that were created.
     */
    readonly entities: Array<EntityType>;
}

/**
 * The events dispatched by {@link Scene}.
 *
 * Declared key by key rather than aliasing the shared map so every entry points at the flavour the
 * browser SDK actually publishes — an alias would leave `on-entities-created` pointing at the
 * shared base class, which has no documented identity here. Structurally identical to the shared
 * map, so {@link Scene} needs no bridge: its inherited listener methods already carry these types.
 * `livelink.js/tests/EventMaps.test.ts` fails to compile if the two ever diverge.
 *
 * @event
 * @category Scene / Events
 */
export type SceneEvents<EntityType extends Entity = Entity> = {
    "on-entities-created": EntitiesCreatedEvent<EntityType>;
    "on-entities-deleted": EntitiesDeletedEvent;
    "on-scene-settings-updated": SceneSettingsUpdatedEvent;
};
