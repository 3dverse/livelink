import type { EditorEntity, Vec2 } from "livelink.core";
import { Entity } from "./Entity";

export class Camera extends Entity {
  constructor(e: EditorEntity) {
    super(e);
  }
  async castScreenSpaceRay({ pos }: { pos: Vec2 }) {
    //LiveLink.castScreenSpaceRay({
    //  camera_rtid: this._getRTID(),
    //  pos,
    //});
  }
}
