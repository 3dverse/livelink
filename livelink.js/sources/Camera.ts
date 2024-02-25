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
  }: {
    pos: Vec2;
  }): Promise<ScreenSpaceRayResult> {
    return await this._core!.castScreenSpaceRay({
      screenSpaceRayQuery: {
        camera_rtid: super.rtid!,
        pos,
        mode: HighlightMode.None,
      },
    });
  }
}
