import { RTID, RTID_BYTE_SIZE, serialize_RTID } from "../../../sources/types";

/**
 *
 */
export type HighlightEntitiesMessage = {
    entities: Array<RTID>;
    keep_old_selection: boolean;
};

/**
 *
 */
export function compute_HighlightEntitiesMessage_size({
    highlightEntitiesMessage,
}: {
    highlightEntitiesMessage: HighlightEntitiesMessage;
}): number {
    return 1 + highlightEntitiesMessage.entities.length * RTID_BYTE_SIZE;
}

/**
 *
 */
export function serialize_HighlightEntitiesMessage({
    data_view,
    offset = 0,
    highlightEntitiesMessage,
}: {
    data_view: DataView;
    offset?: number;
    highlightEntitiesMessage: HighlightEntitiesMessage;
}): number {
    data_view.setUint8(offset, highlightEntitiesMessage.keep_old_selection ? 1 : 0);
    offset += 1;

    for (const rtid of highlightEntitiesMessage.entities) {
        offset += serialize_RTID({ data_view, offset, rtid });
    }

    return 1 + highlightEntitiesMessage.entities.length * RTID_BYTE_SIZE;
}
