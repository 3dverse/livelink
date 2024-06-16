import { RTID, RTID_BYTE_SIZE, Vec2, serialize_RTID, serialize_Vec2 } from "../../../sources/types";

/**
 *
 */
export enum HighlightMode {
    None = 0,
    HighlightAndKeepOldSelection = 1,
    HighlightAndDiscardOldSelection = 2,
}

/**
 *
 */
export type ScreenSpaceRayQuery = {
    camera_rtid: RTID;
    pos: Vec2;
    mode: HighlightMode;
};

/**
 * 8 + 1 + 4
 */
export const SCREEN_SPACE_QUERY_BYTE_SIZE = 13 as const;

/**
 *
 */
export function serialize_ScreenSpaceRayQuery({
    data_view,
    offset = 0,
    screenSpaceRayQuery,
}: {
    data_view: DataView;
    offset?: number;
    screenSpaceRayQuery: ScreenSpaceRayQuery;
}): number {
    offset += serialize_Vec2({ data_view, offset, v: screenSpaceRayQuery.pos });
    data_view.setUint8(offset, screenSpaceRayQuery.mode);
    offset += 1;
    offset += serialize_RTID({
        data_view,
        offset,
        rtid: screenSpaceRayQuery.camera_rtid,
    });
    return 8 + 1 + RTID_BYTE_SIZE;
}
