import { RTID, Vec3, deserialize_RTID, deserialize_Vec3 } from "../../../sources/types";

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
    data_view,
    offset,
}: {
    data_view: DataView;
    offset: number;
}): ScreenSpaceRayResult {
    return {
        entity_rtid: deserialize_RTID({ data_view, offset: offset + 0 }),
        position: deserialize_Vec3({ data_view, offset: offset + 4 }),
        normal: deserialize_Vec3({ data_view, offset: offset + 4 + 3 * 4 }),
    };
}
