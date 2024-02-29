import { LiveLinkCore } from "./LiveLinkCore";
import { EditorEntity, RTID } from "../_prebuild/types";
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
  private euid?: Euid | null = null;
  debug_name?: DebugName;
  lineage?: Lineage;
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
  perspective_lens?: PerspectiveLens;
  camera?: Camera;
  local_transform?: Transform;

  /**
   *
   */
  get rtid(): RTID | null {
    return this.euid.rtid ?? null;
  }
  /**
   *
   */
  get name(): string {
    return this.debug_name.value ?? "<unnamed>";
  }

  /**
   *
   */
  constructor(protected readonly _core: LiveLinkCore) {}

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
        const componentName =
          (p as string)[0] === "_" ? (p as string).slice(1) : (p as string);
        serialized[componentName] = {};
        for (const a in this[p]) {
          if (a !== "__dirty_flag") {
            serialized[componentName][a as string] = this[p][a];
          }
        }
      }
    }
    return serialized;
  }

  /**
   *
   */
  _tryMarkingAsDirty(component_name: string): boolean {
    if (this.isInstantiated()) {
      // Register to appropriate dirty list
      this._core.addEntityToUpdate({ entity: this });
      return true;
    }

    return false;
  }

  /**
   *
   */
  private _parse({ editor_entity }: { editor_entity: EditorEntity }) {
    this.euid = {
      value: (editor_entity.components as { euid: Euid }).euid.value,
      rtid: BigInt(editor_entity.rtid),
    };

    this.local_transform = (
      editor_entity.components as { local_transform: Transform }
    ).local_transform;
  }

  /**
   *
   */
  static handler = {
    get(inst: Entity, prop: PropertyKey): unknown {
      if (prop[0] !== "_") {
        if (typeof inst[prop] === "object" && inst[prop] !== null) {
          //console.log("GET COMPONENT", prop);
          return new Proxy(
            inst[prop],
            new ComponentHandler(inst, prop as string)
          );
        }
      }
      return Reflect.get(inst, prop);
    },

    set(inst: Entity, prop: PropertyKey, v: any): boolean {
      if (prop[0] !== "_") {
        //console.log("SET COMPONENT", prop, v);
        inst._tryMarkingAsDirty(prop as string);
      }
      return Reflect.set(inst, prop, v);
    },

    deleteProperty(inst: Entity, prop: PropertyKey): boolean {
      //console.log("DELETE COMPONENT", prop);
      return Reflect.deleteProperty(inst, prop);
    },
  };
}

/**
 *
 */
class ComponentHandler {
  constructor(
    private readonly _entity: Entity,
    private readonly _component_name: string
  ) {}

  get(inst: object, prop: PropertyKey): unknown {
    //console.log("GET ATTRIBUTE", prop);
    if (prop[0] !== "_") {
      if (
        (typeof inst[prop] === "object" && inst[prop] !== null) ||
        Array.isArray(inst[prop])
      ) {
        return new Proxy(
          inst[prop],
          new ComponentHandler(this._entity, this._component_name)
        );
      }
    }
    return Reflect.get(inst, prop);
  }

  set(inst: object, prop: PropertyKey, v: any): boolean {
    //console.log("SET ATTRIBUTE", prop, v);
    this._entity._tryMarkingAsDirty(this._component_name);
    return Reflect.set(inst, prop, v);
  }

  deleteProperty(inst: object, prop: PropertyKey): boolean {
    //console.log("DELETE ATTRIBUTE", prop);
    return Reflect.deleteProperty(inst, prop);
  }
}
