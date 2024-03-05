import { RTID } from "./types/common";
import { Entity } from "./Entity";
import { LiveLinkCore } from "./LiveLinkCore";
import { UpdateEntitiesFromJsonMessage } from "../_prebuild/types";

/**
 *
 */
export class EntityRegistry {
  /**
   *
   */
  private _entities = new Set<Entity>();

  /**
   *
   */
  private _entity_lut = new Map<RTID, Entity>();

  /**
   *
   */
  private _dirty_entities = new Map<string, Set<Entity>>();

  /**
   *
   */
  private _elapsed_time = 0;

  /**
   *
   */
  constructor() {
    this._dirty_entities.set("local_transform", new Set<Entity>());
    this._dirty_entities.set("perspective_lens", new Set<Entity>());
    this._dirty_entities.set("camera", new Set<Entity>());
  }

  /**
   *
   */
  add({ entity }: { entity: Entity }) {
    if (!entity.rtid) {
      throw new Error(
        "Trying to add an entity without a EUID to the registry."
      );
    }

    const entityRTID = entity.rtid!;
    if (this._entity_lut.has(entityRTID)) {
      throw new Error(
        `Cannot add entity ${entity.name} to the registry,
        because entity ${entity.name} has the same RTID.`
      );
    }

    this._entities.add(entity);
    this._entity_lut.set(entityRTID, entity);
  }

  /**
   *
   */
  remove({ entity }: { entity: Entity }) {
    if (!entity.rtid) {
      throw new Error(
        "Trying to remove an entity without a EUID from the registry."
      );
    }

    if (!this._entity_lut.delete(entity.rtid)) {
      throw new Error(
        "Trying to remove entity {} which has not been registred to the registry."
      );
    }

    this._entities.delete(entity);
  }

  /**
   *
   */
  advanceFrame({ dt }: { dt: number }) {
    for (const entity of this._entities) {
      entity.onUpdate({ elapsed_time: this._elapsed_time });
    }

    this._elapsed_time += dt;
  }

  /**
   * @internal
   */
  _addEntityToUpdate({
    component,
    entity,
  }: {
    component: string;
    entity: Entity;
  }) {
    this._dirty_entities.get(component).add(entity);
  }

  /**
   * @internal
   */
  _getEntitiesToUpdate(): UpdateEntitiesFromJsonMessage | null {
    const updateEntitiesFromJsonMessage = { components: [] };

    for (const [component_name, entities] of this._dirty_entities) {
      if (entities.size !== 0) {
        updateEntitiesFromJsonMessage.components =
          updateEntitiesFromJsonMessage.components ?? [];
        updateEntitiesFromJsonMessage.components.push({
          component_name,
          entities,
        });
      }
    }

    return updateEntitiesFromJsonMessage.components.length > 0
      ? updateEntitiesFromJsonMessage
      : null;
  }

  /**
   * @internal
   */
  _clearDirtyList() {
    for (const [_, entities] of this._dirty_entities) {
      entities.clear();
    }
  }
}
