import { RTID } from "../_prebuild/types";
import { Entity } from "./Entity";

/**
 *
 */
class EntityRegistry {
  /**
   *
   */
  private _entities = new Array<Entity | null>();

  /**
   *
   */
  private _entity_lut = new Map<RTID, number>();

  /**
   *
   */
  add({ entity }: { entity: Entity }) {
    if (!entity.euid) {
      throw new Error(
        "Trying to add an entity without a EUID to the registry."
      );
    }

    const entityRTID = entity.euid.rtid;
    if (this._entity_lut.has(entityRTID)) {
      throw new Error(
        `Cannot add entity ${entity.euid.value} to the registry,
        because entity ${entity.getName()} has the same RTID.`
      );
    }

    const entityIndex = this._entities.push(entity) - 1;
    this._entity_lut.set(entityRTID, entityIndex);
  }

  /**
   *
   */
  remove({ entity }: { entity: Entity }) {
    if (!entity.euid) {
      throw new Error(
        "Trying to remove an entity without a EUID from the registry."
      );
    }

    const entityIndex = this._entity_lut.get(entity.euid.rtid);
    if (entityIndex === undefined) {
      throw new Error(
        "Trying to remove entity {} which has not been registred to the registry."
      );
    }

    this._entities[entityIndex] = null;
    this._entity_lut.delete(entity.euid.rtid);
  }
}
