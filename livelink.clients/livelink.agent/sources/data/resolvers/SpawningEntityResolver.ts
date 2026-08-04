//------------------------------------------------------------------------------
import type { ComponentsManifest } from "@3dverse/livelink.core";
import type { Entity } from "@livelink.base/scene/Entity";
import type { Scene, EntityCreationOptions } from "@livelink.base/scene/Scene";

//------------------------------------------------------------------------------
import type { IngestEvent } from "../IngestEvent";
import { CachingEntityResolver } from "./EntityResolver";

/**
 * Describes the entity the pipeline creates for each new id, under a mapping whose `entities`
 * declares `spawn`.
 *
 * @category Data
 */
export type EntityTemplate = {
    /**
     * The name of the spawned entity. A string may embed the `{id}` placeholder
     * (e.g. `"AGV-{id}"`); a function receives the id and the triggering event.
     */
    name: string | ((params: { id: string; event: IngestEvent }) => string);

    /**
     * The components of the spawned entity. A function receives the id and the triggering event, to
     * derive initial values (e.g. the initial transform) from the first sighting.
     */
    components: ComponentsManifest | ((params: { id: string; event: IngestEvent }) => ComponentsManifest);

    /**
     * Additional entity creation options. Consider `delete_on_client_disconnection: true` so
     * spawned entities vanish with the agent.
     */
    options?: EntityCreationOptions;
};

/**
 * Spawns an entity for each new id, from a template.
 *
 * Use it when the data stream itself defines the population (e.g. one entity per vehicle serial
 * number). The entity is created on the id's first sighting; concurrent events for the same id
 * await the single in-flight creation.
 *
 * @internal
 */
export class SpawningEntityResolver extends CachingEntityResolver {
    /**
     * The template describing the entity spawned for each new id.
     */
    readonly #template: EntityTemplate;

    /**
     * @param params
     * @param params.scene - The scene to spawn entities in.
     * @param params.template - The template describing the entity spawned for each new id.
     * @param params.manage_auto_broadcast - Whether to force `auto_broadcast = false` on the entity
     * spawned for each new id. Defaults to `true`. See {@link CachingEntityResolver}.
     */
    constructor({
        scene,
        template,
        manage_auto_broadcast,
    }: {
        scene: Scene;
        template: EntityTemplate;
        manage_auto_broadcast?: boolean;
    }) {
        super({ scene, manage_auto_broadcast: manage_auto_broadcast ?? true });
        this.#template = template;
    }

    /**
     * Produce the entity for the given id and event.
     */
    protected async _produce({ id, event }: { id: string; event: IngestEvent }): Promise<Entity | null> {
        const { name, components, options } = this.#template;
        return this._scene.newEntity({
            name: typeof name === "function" ? name({ id, event }) : name.replaceAll("{id}", id),
            components: typeof components === "function" ? components({ id, event }) : components,
            options,
        });
    }
}
