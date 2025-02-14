import { RTID, ScriptDataObject } from "@3dverse/livelink.core";
import { Entity } from "./Entity";
import { Scene } from "./Scene";

/**
 * The event that is fired when an entity receives a script event.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */

export class ScriptEventReceived extends Event {
    /**
     * The entity that emitted the script event.
     */
    readonly emitter_entity: Entity | null;

    /**
     * The data object associated with the script event.
     */
    readonly data_object: ScriptDataObject;

    /**
     * @internal
     */
    constructor({
        event_name,
        emitter_entity,
        data_object,
    }: {
        event_name: string;
        emitter_entity: Entity | null;
        data_object: ScriptDataObject;
    }) {
        super(event_name);
        this.emitter_entity = emitter_entity;
        this.data_object = data_object;
    }
}

/**
 * The event that is fired when an entity emits a script event.
 *
 * @event
 * @noInheritDoc
 * @category Scene
 */
export class ScriptEventEmitted extends Event {
    /**
     * The entity that emitted the script event.
     */
    readonly emitter_entity: Entity;

    /**
     * The data object associated with the script event.
     */
    readonly data_object: ScriptDataObject;

    /**
     *
     */
    #scene: Scene;

    /**
     *
     */
    #target_rtids: Array<RTID>;

    /**
     *
     */
    #target_entities: Promise<Array<Entity | null>> | null = null;

    /**
     * The entities that are targeted by the script event.
     * @returns A promise that resolves to an array of entities or null if the entity could not be found.
     */
    get target_entities(): Promise<Array<Entity | null>> {
        if (!this.#target_entities) {
            this.#target_entities = Promise.all(
                this.#target_rtids.map(entity_rtid => this.#scene._findEntity({ entity_rtid })),
            );
        }
        return this.#target_entities;
    }

    /**
     * @internal
     */
    constructor({
        scene,
        event_name,
        emitter_entity,
        target_rtids,
        data_object,
    }: {
        scene: Scene;
        event_name: string;
        emitter_entity: Entity;
        target_rtids: Array<RTID>;
        data_object: ScriptDataObject;
    }) {
        super(event_name);
        this.#scene = scene;
        this.emitter_entity = emitter_entity;
        this.#target_rtids = target_rtids;
        this.data_object = data_object;
    }
}

/**
 * @event
 * @category Scene
 */
export type ScriptEvents<T> = {
    [event_id: string]: T;
};
