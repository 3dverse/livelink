import { LITTLE_ENDIAN } from "./constants";

/**
 *
 */
export type RTID = bigint;

/**
 * 4 for now until 64 bits is supported by backend
 */
export const RTID_BYTE_SIZE = 4 as const;

/**
 *
 */
export function serialize_RTID({
    data_view,
    offset,
    rtid,
}: {
    data_view: DataView;
    offset: number;
    rtid: RTID;
}): number {
    //TODO: change me when we support 64bits RTIDs
    data_view.setUint32(offset, Number(rtid), LITTLE_ENDIAN);
    return 4;
}
/**
 *
 */
export function deserialize_RTID({ data_view, offset }: { data_view: DataView; offset: number }): RTID {
    return BigInt(data_view.getUint32(offset, LITTLE_ENDIAN));
}
