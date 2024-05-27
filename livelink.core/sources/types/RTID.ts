import { LITTLE_ENDIAN } from "./constants";

/**
 *
 */
export type RTID = bigint;

/**
 *
 */
export function serialize_RTID({ dataView, offset, rtid }: { dataView: DataView; offset: number; rtid: RTID }): number {
    //TODO: change me when we support 64bits RTIDs
    dataView.setUint32(offset, Number(rtid), LITTLE_ENDIAN);
    return 4;
}
/**
 *
 */
export function deserialize_RTID({ dataView, offset }: { dataView: DataView; offset: number }): RTID {
    return BigInt(dataView.getUint32(offset, LITTLE_ENDIAN));
}
