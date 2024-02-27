import {
  Vec2,
  HighlightMode,
  ScreenSpaceRayResult,
  Entity,
} from "@livelink.core";

/**
 *
 */
export class Camera extends Entity {
  /**
   *
   */
  async castScreenSpaceRay({
    pos,
    mode = HighlightMode.None,
  }: {
    pos: Vec2;
    mode: HighlightMode;
  }): Promise<ScreenSpaceRayResult> {
    return await this._core!.castScreenSpaceRay({
      screenSpaceRayQuery: {
        camera_rtid: super.rtid!,
        pos,
        mode,
      },
    });
  }
}
