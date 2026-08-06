import type { Entity } from "./Entity";
import { EntitiesCreatedEvent as EntitiesCreatedEventBase } from "@livelink.base/scene/SceneEvents";

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
 * The browser SDK resolves entities as its proxied {@link Entity}, so the shared entity-creation
 * event is re-exported here with its type parameter rebound to the browser Entity (the shared base
 * defaults it to the headless entity) — consumers can write `EntitiesCreatedEvent` and get the
 * browser Entity. Declared as an interface rather than a type alias so the payload it carries is
 * documented on the type consumers actually see.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export interface EntitiesCreatedEvent<EntityType extends Entity = Entity> extends EntitiesCreatedEventBase<EntityType> {
    /**
     * The entities that were created.
     */
    readonly entities: Array<EntityType>;
}
