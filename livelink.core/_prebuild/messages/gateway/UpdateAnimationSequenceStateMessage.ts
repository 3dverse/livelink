import { RTID, RTID_BYTE_SIZE, UUID, UUID_BYTE_SIZE, serialize_RTID, serialize_UUID } from "../../../sources/types";
import { LITTLE_ENDIAN } from "../../../sources/types/constants";

/**
 *
 */
export type UpdateAnimationSequenceStateMessage = {
    linker_rtid: RTID;
    animation_sequence_id: UUID;
    state: 0 | 1;
    playback_speed: number;
    seek_offset?: number;
};

/**
 *
 */
export function serialize_UpdateAnimationSequenceStateMessage({
    dataView,
    offset,
    updateAnimationSequenceStateMessage,
}: {
    dataView: DataView;
    offset: number;
    updateAnimationSequenceStateMessage: UpdateAnimationSequenceStateMessage;
}): number {
    offset += serialize_RTID({ dataView, offset, rtid: updateAnimationSequenceStateMessage.linker_rtid });
    offset += serialize_UUID({ dataView, offset, uuid: updateAnimationSequenceStateMessage.animation_sequence_id });
    dataView.setInt32(offset, updateAnimationSequenceStateMessage.state, LITTLE_ENDIAN);
    offset += 4;
    dataView.setFloat32(offset, updateAnimationSequenceStateMessage.playback_speed, LITTLE_ENDIAN);
    offset += 4;

    const s = updateAnimationSequenceStateMessage.seek_offset !== undefined ? 4 : 0;
    if (s !== 0) {
        dataView.setFloat32(offset, updateAnimationSequenceStateMessage.seek_offset!, LITTLE_ENDIAN);
    }

    return RTID_BYTE_SIZE + UUID_BYTE_SIZE + 4 + 4 + s;
}
