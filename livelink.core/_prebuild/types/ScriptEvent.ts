import { RTID, deserialize_RTID } from "../../sources/types";
import { LITTLE_ENDIAN } from "../../sources/types/constants";

/**
 *
 */
export type ScriptEvent = {
    emitter_rtid: RTID;
    event_name: string;
    entity_rtids: Array<RTID>;
    data_object: Record<string, object>;
};

/**
 *
 */
export function deserialize_ScriptEvent({ dataView, offset }: { dataView: DataView; offset: number }): ScriptEvent {
    const emitter_rtid = deserialize_RTID({ dataView, offset });
    offset += 4;

    const event_name_size = dataView.getUint16(offset, LITTLE_ENDIAN);
    offset += 2;

    const event_name = new TextDecoder().decode(
        new DataView(dataView.buffer, dataView.byteOffset + offset, event_name_size),
    );
    offset += event_name_size;

    const entity_count = dataView.getUint16(offset, LITTLE_ENDIAN);
    offset += 2;

    const entity_rtids = Array(entity_count).map((_, index) =>
        deserialize_RTID({ dataView, offset: offset + index * 4 }),
    );
    offset += 4 * entity_count;

    const json_size = dataView.getUint16(offset, LITTLE_ENDIAN);
    offset += 2;

    const data_object_str = new TextDecoder().decode(
        new DataView(dataView.buffer, dataView.byteOffset + offset, json_size),
    );

    return {
        emitter_rtid,
        event_name,
        entity_rtids,
        data_object: JSON.parse(data_object_str),
    };
}
