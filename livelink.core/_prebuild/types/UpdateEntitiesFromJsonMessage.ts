import { Entity, serialize_RTID } from "../../sources";
import { LITTLE_ENDIAN } from "../../sources/types/constants";
import { ComponentHash } from "./components";

/**
 *
 */
export type UpdateEntitiesFromJsonMessage = {
  components: Array<{
    component_name: string;
    entities: Array<Entity>;
  }>;
};

/**
 *
 */
export function compute_UpdateEntitiesFromJsonMessage_size(
  updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage
) {
  let msgSize = 0;
  // +    componentCount (4)
  const componentCount = updateEntitiesFromJsonMessage.components.length;
  msgSize += 4;
  // +    componentCount * { componentHash (4), entityCount (4) }
  msgSize += componentCount * (4 + 4);
  //      for each component
  for (const componentUpdate of updateEntitiesFromJsonMessage.components) {
    // +        entityCount * { entityRTID (4) }
    const entityCount = componentUpdate.entities.length;
    msgSize += entityCount * 4;
    //          for each entity
    for (const entity of componentUpdate.entities) {
      // +            jsonSize (4)
      msgSize += 4;
      // +            json (jsonLength)
      msgSize += JSON.stringify(entity[componentUpdate.component_name]).length;
    }
  }
  return msgSize;
}

/**
 *
 */
export function serialize_UpdateEntitiesFromJsonMessage({
  dataView,
  offset,
  updateEntitiesFromJsonMessage,
}: {
  dataView: DataView;
  offset: number;
  updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage;
}) {
  // + componentCount (4)
  const componentCount = updateEntitiesFromJsonMessage.components.length;
  dataView.setUint32(offset, componentCount, LITTLE_ENDIAN);
  offset += 4;

  for (const componentUpdate of updateEntitiesFromJsonMessage.components) {
    // + { componentHash (4), entityCount (4) }
    const componentHash = ComponentHash[componentUpdate.component_name];
    dataView.setUint32(offset, componentHash, LITTLE_ENDIAN);
    offset += 4;

    const entityCount = componentUpdate.entities.length;
    dataView.setUint32(offset, entityCount, LITTLE_ENDIAN);
    offset += 4;
  }

  for (const componentUpdate of updateEntitiesFromJsonMessage.components) {
    for (const entity of componentUpdate.entities) {
      // + { entityRTID (4) }
      offset += serialize_RTID({
        dataView: dataView,
        offset,
        rtid: entity.rtid,
      });
    }

    for (const entity of componentUpdate.entities) {
      const jsonStr = JSON.stringify(entity[componentUpdate.component_name]);

      // + jsonSize (4)
      const jsonSize = jsonStr.length;
      dataView.setUint32(offset, jsonSize, LITTLE_ENDIAN);
      offset += 4;

      // + json (jsonLength)
      for (let i = 0; i < jsonSize; ++i) {
        dataView.setUint8(offset, jsonStr.charCodeAt(i));
        offset += 1;
      }
    }
  }
}
