import { LiveLinkCore } from "./LiveLinkCore";
import { EditorEntity } from "../_prebuild/types";
import type {
  AABB,
  AnimationController,
  BoxGeometry,
  Camera,
  CapsuleGeometry,
  DebugName,
  Euid,
  Lineage,
  MaterialRef,
  MeshRef,
  PerspectiveLens,
  RigidBody,
  SceneRef,
  ScriptMap,
  SkeletonRef,
  SphereGeometry,
  Transform,
} from "../_prebuild/types/components";

/**
 *
 */
export class Entity {
  private euid: Euid | null = null;

  debug_name?: DebugName;
  lineage?: Lineage;
  local_transform?: Transform;
  scene_ref?: SceneRef;
  mesh_ref?: MeshRef;
  material_ref?: MaterialRef;
  skeleton_ref?: SkeletonRef;
  animation_controller?: AnimationController;
  script_map?: ScriptMap;
  local_aabb?: AABB;
  box_geometry?: BoxGeometry;
  sphere_geometry?: SphereGeometry;
  capsule_geometry?: CapsuleGeometry;
  rigid_body?: RigidBody;
  camera?: Camera;
  perspective_lens?: PerspectiveLens;

  /**
   *
   */
  get name(): string {
    return this.debug_name ? this.debug_name.value : "<unnamed>";
  }

  /**
   *
   */
  get rtid() {
    return this.euid?.rtid;
  }

  /**
   *
   */
  constructor(protected _core: LiveLinkCore) {}

  /**
   *
   */
  init(from: EditorEntity | string) {
    if (typeof from === "string") {
      this.debug_name = { value: from };
    } else {
      this._parse({ editor_entity: from });
    }

    return this;
  }

  /**
   *
   */
  isInstantiated(): boolean {
    return this.euid !== null;
  }

  /**
   *
   */
  async instantiate() {
    if (this.isInstantiated()) {
      throw new Error("Entity is already instantiated");
    }

    const editor_entity = await this._core.createEntity({ entity: this });
    this._parse({ editor_entity });
  }

  /**
   *
   */
  toJSON() {
    let serialized = {};
    for (const p in this) {
      if (this[p] !== undefined && p !== "euid" && p !== "_core") {
        serialized[p as string] = this[p];
      }
    }
    return serialized;
  }

  /**
   *
   */
  private _parse({ editor_entity }: { editor_entity: EditorEntity }) {
    this.euid = {
      value: (editor_entity.components as { euid: Euid }).euid.value,
      rtid: BigInt(editor_entity.rtid),
    };
  }
}
