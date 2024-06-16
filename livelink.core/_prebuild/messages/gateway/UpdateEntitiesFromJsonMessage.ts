import { RTID_BYTE_SIZE, serialize_RTID } from "../../../sources/types";
import { LITTLE_ENDIAN } from "../../../sources/types/constants";
import { EntityInterface } from "../../../sources/interfaces/EntityInterface";
import { ComponentHash, ComponentType } from "../../types/components";

/**
 *
 */
export type UpdateEntitiesFromJsonMessage = {
    components: Array<{
        component_type: ComponentType;
        entities: Set<EntityInterface>;
    }>;
};

/**
 *
 */
export function compute_UpdateEntitiesFromJsonMessage_size(
    updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage,
) {
    let msgSize = 0;
    // +    componentCount (4)
    const componentCount = updateEntitiesFromJsonMessage.components.length;
    msgSize += 4;
    // +    componentCount * { componentHash (4), entityCount (4) }
    msgSize += componentCount * (4 + 4);
    //      for each component
    for (const componentUpdate of updateEntitiesFromJsonMessage.components) {
        // +        entityCount * { entityRTID }
        const entityCount = componentUpdate.entities.size;
        msgSize += entityCount * RTID_BYTE_SIZE;
        //          for each entity
        for (const entity of componentUpdate.entities) {
            // +            jsonSize (4)
            msgSize += 4;
            // +            json (jsonLength)
            //@ts-ignore
            msgSize += JSON.stringify(entity[componentUpdate.component_type]).length;
        }
    }
    return msgSize;
}

/**
 *
 */
export function serialize_UpdateEntitiesFromJsonMessage({
    data_view,
    offset = 0,
    updateEntitiesFromJsonMessage,
}: {
    data_view: DataView;
    offset?: number;
    updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage;
}) {
    // + componentCount (4)
    const componentCount = updateEntitiesFromJsonMessage.components.length;
    data_view.setUint32(offset, componentCount, LITTLE_ENDIAN);
    offset += 4;

    for (const componentUpdate of updateEntitiesFromJsonMessage.components) {
        // + { componentHash (4), entityCount (4) }
        const componentHash = ComponentHash[componentUpdate.component_type];
        data_view.setUint32(offset, componentHash, LITTLE_ENDIAN);
        offset += 4;

        const entityCount = componentUpdate.entities.size;
        data_view.setUint32(offset, entityCount, LITTLE_ENDIAN);
        offset += 4;

        for (const entity of componentUpdate.entities) {
            // + { entityRTID (4) }
            offset += serialize_RTID({
                data_view: data_view,
                offset,
                rtid: entity.rtid!,
            });
        }

        for (const entity of componentUpdate.entities) {
            //@ts-ignore
            const jsonStr = JSON.stringify(entity[componentUpdate.component_type]);

            // + jsonSize (4)
            const jsonSize = jsonStr.length;
            data_view.setUint32(offset, jsonSize, LITTLE_ENDIAN);
            offset += 4;

            // + json (jsonLength)
            for (let i = 0; i < jsonSize; ++i) {
                data_view.setUint8(offset, jsonStr.charCodeAt(i));
                offset += 1;
            }
        }
    }
}
