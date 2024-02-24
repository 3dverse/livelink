import type { Vec2 } from "livelink.core";
import { Entity } from "./Entity";

export class Camera extends Entity {
  async castScreenSpaceRay({ pos }: { pos: Vec2 }) {
    //LiveLink.castScreenSpaceRay({
    //  camera_rtid: this._getRTID(),
    //  pos,
    //});
  }
}
