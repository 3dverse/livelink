import { Entity } from "./Entity";
import { LiveLink } from "../core/sources/LiveLink";
import { Vec2 } from "../_prebuild/types";

export class Camera extends Entity {
  async castScreenSpaceRay({ pos }: { pos: Vec2 }) {
    //LiveLink.castScreenSpaceRay({
    //  camera_rtid: this._getRTID(),
    //  pos,
    //});
  }
}
