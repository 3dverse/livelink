import { Vec2, HighlightMode, ScreenSpaceRayResult } from "@livelink.core";
import { Entity } from "./Entity";
import {} from "@livelink.core";

export class Camera extends Entity {
  /**
   *
   */
  async castScreenSpaceRay({
    pos,
  }: {
    pos: Vec2;
  }): Promise<ScreenSpaceRayResult> {
    return await this._livelink_instance!.castScreenSpaceRay({
      screenSpaceRayQuery: {
        camera_rtid: super.rtid!,
        pos,
        mode: HighlightMode.None,
      },
    });
  }
}
