import { RTID, RTID_BYTE_SIZE, UUID, UUID_BYTE_SIZE, serialize_UUID } from "../../../sources/types";
import { LITTLE_ENDIAN } from "../../../sources/types/constants";

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
    return (
        UUID_BYTE_SIZE +
        fireEventMessage.event_name.length +
        1 +
        1 +
        4 +
        fireEventMessage.entities.length * RTID_BYTE_SIZE
    );
}

/**
 *
 */
export function serialize_FireEventMessage({
    data_view,
    offset = 0,
    fireEventMessage,
}: {
    data_view: DataView;
    offset?: number;
    fireEventMessage: FireEventMessage;
}): number {
    offset += serialize_UUID({ data_view, offset, uuid: fireEventMessage.event_map_id });

    for (let i = 0; i < fireEventMessage.event_name.length; i++) {
        data_view.setUint8(offset++, fireEventMessage.event_name.charCodeAt(i));
    }

    // Null terminate event name.
    ++offset;

    // Null terminate data object.
    ++offset;

    data_view.setUint32(offset, 0, LITTLE_ENDIAN);
    offset += 4;

    return UUID_BYTE_SIZE + fireEventMessage.event_name.length + 1 + 1 + 4;
}
