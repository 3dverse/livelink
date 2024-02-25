import { RTID } from "./types/common";
import { CoreEntity } from "./CoreEntity";

/**
 *
 */
class EntityRegistry {
  /**
   *
   */
  private _entities = new Array<CoreEntity | null>();

  /**
   *
   */
  private _entity_lut = new Map<RTID, number>();

  /**
   *
   */
  add({ entity }: { entity: CoreEntity }) {
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

    const entityIndex = this._entities.push(entity) - 1;
    this._entity_lut.set(entityRTID, entityIndex);
  }

  /**
   *
   */
  remove({ entity }: { entity: CoreEntity }) {
    if (!entity.rtid) {
      throw new Error(
        "Trying to remove an entity without a EUID from the registry."
      );
    }

    const entityIndex = this._entity_lut.get(entity.rtid);
    if (entityIndex === undefined) {
      throw new Error(
        "Trying to remove entity {} which has not been registred to the registry."
      );
    }

    this._entities[entityIndex] = null;
    this._entity_lut.delete(entity.rtid);
  }
}
