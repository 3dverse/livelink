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
  OrthographicLens,
  PerspectiveLens,
  PointLight,
  RigidBody,
  SceneRef,
  ScriptMap,
  SkeletonRef,
  SphereGeometry,
  Transform,
} from "../_prebuild/types/components";
import { RTID, UUID } from "./types";

/**
 *
 */
export class Entity extends EventTarget {
  private euid: Euid | null = null;
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
  orthographic_lens?: OrthographicLens;
  camera?: Camera;
  local_transform?: Transform;
  point_light: PointLight;

  __self: Entity = null;

  /**
   *
   */
  get rtid(): RTID | null {
    return this.euid?.rtid ?? null;
  }
  /**
   *
   */
  get id(): UUID | null {
    return this.euid?.value ?? null;
  }
  /**
   *
   */
  get name(): string {
    return this.debug_name?.value ?? "<unnamed>";
  }

  /**
   *
   */
  constructor(protected readonly _core: LiveLinkCore) {
    super();
  }

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
  onCreate() {}

  /**
   *
   */
  onUpdate({ elapsed_time }: { elapsed_time: number }) {}

  /**
   *
   */
  onTriggerEntered() {}

  /**
   *
   */
  onTriggerExited() {}

  /**
   *
   */
  async instantiate() {
    if (this.isInstantiated()) {
      throw new Error("Entity is already instantiated");
    }

    const editor_entity = await this._core.createEntity({ entity: this });
    this._parse({ editor_entity });
    this._core.entity_registry.add({ entity: this });
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
  _updateFromEvent({
    updated_components,
  }: {
    updated_components: Record<string, unknown>;
  }) {
    for (const key in updated_components) {
      this.__self[key] = updated_components[key];
    }

    this.__self.dispatchEvent(new CustomEvent("entity-updated"));
  }

  /**
   *
   */
  _tryMarkingAsDirty({ component_name }: { component_name: string }): boolean {
    if (component_name !== "euid" && this.isInstantiated()) {
      // Register to appropriate dirty list
      this._core.entity_registry._addEntityToUpdate({
        component_name,
        entity: this,
      });
      return true;
    }

    return false;
  }

  /**
   *
   */
  private _parse({ editor_entity }: { editor_entity: EditorEntity }) {
    for (const component_name in editor_entity.components) {
      this[component_name] = editor_entity.components[component_name];
    }

    // Remove any undefined component
    for (const k of Object.keys(this)) {
      if (this[k] === undefined) {
        delete this[k];
      }
    }

    const components = editor_entity.components as {
      euid: Euid;
      debug_name: DebugName;
      local_transform: Transform;
    };

    this.euid = {
      value: components.euid.value,
      rtid: BigInt(editor_entity.rtid),
    };

    this.local_transform = components.local_transform;

    this.debug_name = components.debug_name;
  }

  /**
   *
   */
  static handler = {
    get(entity: Entity, prop: PropertyKey): unknown {
      if (prop === "__self") {
        return entity;
      }

      if (prop[0] !== "_") {
        if (typeof entity[prop] === "object" && entity[prop] !== null) {
          //console.log("GET COMPONENT", prop);
          return new Proxy(
            entity[prop],
            new ComponentHandler(entity, prop as string)
          );
        }
      }
      return Reflect.get(entity, prop);
    },

    set(entity: Entity, prop: PropertyKey, v: any): boolean {
      if (prop[0] !== "_") {
        //console.log("SET COMPONENT", prop, v);
        entity._tryMarkingAsDirty({ component_name: prop as string });
      }
      return Reflect.set(entity, prop, v);
    },

    deleteProperty(entity: Entity, prop: PropertyKey): boolean {
      //console.log("DELETE COMPONENT", prop);
      return Reflect.deleteProperty(entity, prop);
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

  get(component: object, prop: PropertyKey): unknown {
    //console.log("GET ATTRIBUTE", prop);
    if (prop[0] !== "_") {
      if (
        (typeof component[prop] === "object" && component[prop] !== null) ||
        Array.isArray(component[prop])
      ) {
        return new Proxy(
          component[prop],
          new ComponentHandler(this._entity, this._component_name)
        );
      }
    }
    return Reflect.get(component, prop);
  }

  set(component: object, prop: PropertyKey, v: any): boolean {
    //console.log("SET ATTRIBUTE", prop, v);
    this._entity._tryMarkingAsDirty({ component_name: this._component_name });
    return Reflect.set(component, prop, v);
  }

  deleteProperty(component: object, prop: PropertyKey): boolean {
    //console.log("DELETE ATTRIBUTE", prop);
    return Reflect.deleteProperty(component, prop);
  }
}
