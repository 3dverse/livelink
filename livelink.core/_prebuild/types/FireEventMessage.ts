import { RTID, UUID, serialize_UUID } from "../../sources/types";
import { LITTLE_ENDIAN } from "../../sources/types/constants";

/**
 *
 */
export type FireEventMessage = {
    event_map_id: UUID;
    event_name: string;
    entities: Array<RTID>;
    data_object: Record<string, unknown>;
};

/**
 *
 */
export function compute_FireEventMessage_size(fireEventMessage: FireEventMessage) {
    const UUID_SIZE = 16;
    const RTID_SIZE = 4;
    return UUID_SIZE + fireEventMessage.event_name.length + 1 + 1 + 4 + fireEventMessage.entities.length * RTID_SIZE;
}

/**
 *
 */
export function serialize_FireEventMessage({
    dataView,
    offset,
    fireEventMessage,
}: {
    dataView: DataView;
    offset: number;
    fireEventMessage: FireEventMessage;
}): number {
    offset += serialize_UUID({ dataView, offset, uuid: fireEventMessage.event_map_id });

    for (let i = 0; i < fireEventMessage.event_name.length; i++) {
        dataView.setUint8(offset++, fireEventMessage.event_name.charCodeAt(i));
    }

    // Null terminate event name.
    ++offset;

    // Null terminate data object.
    ++offset;

    dataView.setUint32(offset, 0, LITTLE_ENDIAN);
    offset += 4;

    return 16 + fireEventMessage.event_name.length + 1 + 1 + 4;
}
