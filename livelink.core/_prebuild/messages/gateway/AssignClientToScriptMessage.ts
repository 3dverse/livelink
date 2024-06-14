import { RTID, RTID_BYTE_SIZE, UUID, UUID_BYTE_SIZE, serialize_RTID, serialize_UUID } from "../../../sources/types";

/**
 *
 */
export type AssignClientToScriptMessage = {
    client_uuid: UUID;
    script_uuid: UUID;
    entity_rtid: RTID;
};

/**
 *
 */
export function serialize_assignClientToScriptMessage({
    dataView,
    offset,
    assignClientToScriptMessage,
}: {
    dataView: DataView;
    offset: number;
    assignClientToScriptMessage: AssignClientToScriptMessage;
}) {
    const { client_uuid, script_uuid, entity_rtid } = assignClientToScriptMessage;

    offset += serialize_UUID({ dataView, offset, uuid: client_uuid });
    offset += serialize_UUID({ dataView, offset, uuid: script_uuid });
    offset += serialize_RTID({ dataView, offset, rtid: entity_rtid });

    return UUID_BYTE_SIZE * 2 + RTID_BYTE_SIZE;
}
