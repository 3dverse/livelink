import { Vec3 } from "@3dverse/livelink.core";
import { Entity } from "../scene/Entity";

/**
 * @experimental
 *
 * The event that is fired when an entity is hovered.
 *
 * @event
 * @noInheritDoc
 * @category Rendering
 */
export class EntityHoveredEvent extends Event {
    /**
     * The entity that is currently picked or hovered or null if no entity is picked or hovered.
     */
    public readonly hovered_entity: Entity | null;

    /**
     * The world space position of the entity that is currently picked or hovered or null if no entity is picked or hovered.
     */
    public readonly ws_position: Vec3 | null;

    /**
     * The world space normal of the entity that is currently picked or hovered or null if no entity is picked or hovered.
     */
    public readonly ws_normal: Vec3 | null;

    /**
     * @internal
     */
    constructor({
        hovered_entity,
        ws_position,
        ws_normal,
    }: {
        hovered_entity: Entity | null;
        ws_position: Vec3 | null;
        ws_normal: Vec3 | null;
    }) {
        super("on-entity-hovered");
        this.hovered_entity = hovered_entity;
        this.ws_position = ws_position;
        this.ws_normal = ws_normal;
    }
}

/**
 * The event that is fired when an entity is picked.
 *
 * @event
 * @noInheritDoc
 * @category Rendering
 */
export class EntityPickedEvent extends Event {
    /**
     * The entity that is currently picked or hovered or null if no entity is picked or hovered.
     */
    public readonly picked_entity: Entity | null;

    /**
     * The world space position of the entity that is currently picked or hovered or null if no entity is picked or hovered.
     */
    public readonly ws_position: Vec3 | null;

    /**
     * The world space normal of the entity that is currently picked or hovered or null if no entity is picked or hovered.
     */
    public readonly ws_normal: Vec3 | null;

    /**
     * @internal
     */
    constructor({
        picked_entity,
        ws_position,
        ws_normal,
    }: {
        picked_entity: Entity | null;
        ws_position: Vec3 | null;
        ws_normal: Vec3 | null;
    }) {
        super("on-entity-picked");
        this.picked_entity = picked_entity;
        this.ws_position = ws_position;
        this.ws_normal = ws_normal;
    }
}

/**
 * @event
 * @category Rendering
 */
export type ViewportEvents = {
    "on-entity-picked": EntityPickedEvent;

    /**
     * @experimental
     */
    "on-entity-hovered": EntityHoveredEvent;
};
