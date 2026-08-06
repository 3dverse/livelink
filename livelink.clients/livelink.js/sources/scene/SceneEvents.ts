import type { Entity } from "./Entity";
import { EntitiesCreatedEvent as EntitiesCreatedEventBase } from "@livelink.base/scene/SceneEvents";

/**
 * @internal
 */
export const EntitiesCreatedEvent = EntitiesCreatedEventBase;
/**
 * The browser SDK resolves entities as its proxied {@link Entity}, so the shared entity-creation
 * event is re-exported here with its default type parameter rebound to the browser Entity (the
 * shared base defaults it to the headless `EntityBase`). The runtime value is unchanged — only
 * the type default differs — so consumers can write `EntitiesCreatedEvent` for the browser Entity.
 *
 * @event
 * @category Scene
 */
export type EntitiesCreatedEvent<EntityType extends Entity = Entity> = EntitiesCreatedEventBase<EntityType>;
