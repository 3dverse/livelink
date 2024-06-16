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
 * UUID_BYTE_SIZE * 2 + RTID_BYTE_SIZE;
 */
export const ASSIGN_CLIENT_TO_SCRIPT_MESSAGE_BYTE_SIZE = 36 as const;

/**
 *
 */
export function serialize_AssignClientToScriptMessage({
    data_view,
    offset = 0,
    assignClientToScriptMessage,
}: {
    data_view: DataView;
    offset?: number;
    assignClientToScriptMessage: AssignClientToScriptMessage;
}) {
    const { client_uuid, script_uuid, entity_rtid } = assignClientToScriptMessage;

    offset += serialize_UUID({ data_view, offset, uuid: client_uuid });
    offset += serialize_UUID({ data_view, offset, uuid: script_uuid });
    offset += serialize_RTID({ data_view, offset, rtid: entity_rtid });

    return UUID_BYTE_SIZE * 2 + RTID_BYTE_SIZE;
}
