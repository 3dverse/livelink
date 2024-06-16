import { LITTLE_ENDIAN } from "../../../sources/types/constants";
import { EntityInterface, RTID_BYTE_SIZE, serialize_RTID } from "../../../sources";
import { ComponentHash, ComponentType } from "../../types/components";

/**
 *
 */
export type RemoveComponentsCommand = {
    components: Array<{ component_type: ComponentType; entities: Set<EntityInterface> }>;
};

/**
 *
 */
export function compute_RemoveComponentsCommand_size(removeComponentsCommand: RemoveComponentsCommand) {
    let msgSize = 0;
    // +    componentCount (4)
    msgSize += 4;
    //      for each component
    for (const componentUpdate of removeComponentsCommand.components) {
        // +    componentHash (4)
        msgSize += 4;
        // +    entityCount (4)
        msgSize += 4;
        // +    entityCount * entityRTID
        const entityCount = componentUpdate.entities.size;
        msgSize += entityCount * RTID_BYTE_SIZE;
    }
    return msgSize;
}

/**
 *
 */
export function serialize_RemoveComponentsCommand({
    data_view,
    offset = 0,
    removeComponentsCommand,
}: {
    data_view: DataView;
    offset?: number;
    removeComponentsCommand: RemoveComponentsCommand;
}) {
    // + componentCount (4)
    const componentCount = removeComponentsCommand.components.length;
    data_view.setUint32(offset, componentCount, LITTLE_ENDIAN);
    offset += 4;

    for (const componentUpdate of removeComponentsCommand.components) {
        // + componentHash (4)
        const componentHash = ComponentHash[componentUpdate.component_type];
        data_view.setUint32(offset, componentHash, LITTLE_ENDIAN);
        offset += 4;

        // + entityCount (4)
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
    }
}
