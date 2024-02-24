import { Vec2, serialize_Vec2 } from "./Math";
import { RTID, serialize_RTID } from "./common";

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
 *
 */
export function serialize_ScreenSpaceRayQuery({
  dataView,
  offset,
  screenSpaceRayQuery,
}: {
  dataView: DataView;
  offset: number;
  screenSpaceRayQuery: ScreenSpaceRayQuery;
}): number {
  offset += serialize_Vec2({ dataView, offset, v: screenSpaceRayQuery.pos });
  dataView.setUint8(offset, screenSpaceRayQuery.mode);
  offset += 1;
  offset += serialize_RTID({
    dataView,
    offset,
    rtid: screenSpaceRayQuery.camera_rtid,
  });
  return 2 * 4 + 1 + 4;
}
