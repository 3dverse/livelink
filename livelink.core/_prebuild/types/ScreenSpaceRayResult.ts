import { RTID, Vec3, deserialize_RTID, deserialize_Vec3 } from "../../sources/types";

/**
 *
 */
export type ScreenSpaceRayResult = {
    entity_rtid: RTID;
    position: Vec3;
    normal: Vec3;
};

/**
 *
 */
export function deserialize_ScreenSpaceRayResult({
    dataView,
    offset,
}: {
    dataView: DataView;
    offset: number;
}): ScreenSpaceRayResult {
    return {
        entity_rtid: deserialize_RTID({ dataView, offset: offset + 0 }),
        position: deserialize_Vec3({ dataView, offset: offset + 4 }),
        normal: deserialize_Vec3({ dataView, offset: offset + 4 + 3 * 4 }),
    };
}
