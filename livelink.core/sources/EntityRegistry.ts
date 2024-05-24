import {
  ComponentDescriptor,
  UpdateEntitiesFromJsonMessage,
} from "../_prebuild/types";
import type { RTID } from "./types/RTID";
import { Entity } from "./Entity";
import { ComponentSerializer } from "./ComponentSerializer";

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
  private _serializer: ComponentSerializer | null = null;

  /**
   *
   */
  add({ entity }: { entity: Entity }): void {
    if (!entity.rtid) {
      throw new Error(
        "Trying to add an entity without a EUID to the registry."
      );
    }

    if (this._entity_lut.has(entity.rtid)) {
      throw new Error(
        `Cannot add entity ${entity.name} to the registry, because entity
        ${this._entity_lut.get(entity.rtid).name} has the same RTID.`
      );
    }

    this._entities.add(entity);
    this._entity_lut.set(entity.rtid, entity);
  }

  /**
   *
   */
  remove({ entity }: { entity: Entity }): void {
    if (!entity.rtid) {
      throw new Error(
        "Trying to remove an entity without a EUID from the registry."
      );
    }

    if (!this._entity_lut.delete(entity.rtid)) {
      throw new Error(
        `Trying to remove entity ${entity.rtid} which has not been registred to the registry.`
      );
    }

    this._entities.delete(entity);
  }

  /**
   *
   */
  get({ entity_rtid }: { entity_rtid: RTID }): Entity | null {
    return this._entity_lut.get(entity_rtid) ?? null;
  }

  /**
   * @internal
   */
  _configureComponentSerializer({
    component_descriptors,
  }: {
    component_descriptors: Record<string, ComponentDescriptor>;
  }) {
    this._serializer = new ComponentSerializer(component_descriptors);

    for (const component_name of this._serializer.component_names) {
      this._dirty_entities.set(component_name, new Set<Entity>());
    }
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
    component_name,
    entity,
  }: {
    component_name: string;
    entity: Entity;
  }) {
    const dirty_entities = this._dirty_entities.get(component_name);
    if (dirty_entities) {
      dirty_entities.add(entity);
    }
  }

  /**
   * @internal
   */
  _getEntitiesToUpdate(): UpdateEntitiesFromJsonMessage | null {
    const msg = { components: [] };

    for (const [component_name, entities] of this._dirty_entities) {
      if (entities.size !== 0) {
        msg.components.push({ component_name, entities });
      }
    }

    return msg.components.length > 0 ? msg : null;
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
