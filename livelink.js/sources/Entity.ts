/*
import type { RTID, Components, Vec3, Quat } from "livelink.core";

type local_transform = {
  position: Vec3;
  orientation: Quat;
  scale: Vec3;
};
type material_ref = {};
type scene_ref = {};
type perspective_lens = {};

export class Entity {
  private _components: Map<
    string,
    local_transform | material_ref | scene_ref | perspective_lens
  > = new Map<string, local_transform | material_ref | scene_ref>();

  get local_transform() {
    return this._components.get("local_transform") as local_transform;
  }

  static async create<T>({ context }: { context: LiveLinkCore }): Promise<T> {
    const components = new Map<string, Components>();
    await context.createEntity({ components });
    return new Entity() as T;
  }

  isAttached<Component>(): boolean {
    return true;
  }

  protected _getRTID(): RTID {
    const rtid: RTID = 0n;
    return rtid;
  }
}

const e = new Entity();
//e.get<local_transform>();
*/

import { Components, EditorEntity, Quat, RTID, Vec3 } from "@livelink.core";

export type local_transform = {
  position?: Vec3;
  orientation?: Quat;
  scale?: Vec3;
};

export type debug_name = {
  value?: string;
};

export class Entity extends EventTarget {
  camera?: {};
  perspective_lens?: {};
  local_transform: local_transform = {
    position: [0, 0, 0],
    orientation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  };
  debug_name: debug_name = { value: "<unnamed>" };

  private _rtid?: RTID = 0n;

  get rtid() {
    return this._rtid;
  }

  constructor(c: Components);
  constructor(e: EditorEntity);
  constructor(e: EditorEntity | Components) {
    super();

    if (!(e instanceof Map)) {
      this._rtid = BigInt(e.rtid);
    }
  }
}
