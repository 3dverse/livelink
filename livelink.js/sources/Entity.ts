import { ComponentHash, ComponentType, EditorEntity, EntityBase, EntityCreationOptions, UUID } from "@livelink.core";
import { Scene } from "./Scene";

/**
 *
 */
type EntityAutoUpdateState = "on" | "off";

/**
 *
 */
class InvalidEntityError extends Error {}

/**
 *
 */
export class Entity extends EntityBase {
    /**
     *
     */
    private _proxy_state: EntityAutoUpdateState = "on";

    /**
     *
     */
    private _auto_update: EntityAutoUpdateState = "on";

    /**
     *
     */
    private _auto_broadcast: EntityAutoUpdateState = "on";

    /**
     *
     */
    get auto_update(): EntityAutoUpdateState {
        return this._auto_update;
    }
    /**
     *
     */
    set auto_update(state: EntityAutoUpdateState) {
        this._auto_update = state;
    }

    /**
     *
     */
    get auto_broadcast(): EntityAutoUpdateState {
        return this._auto_broadcast;
    }
    /**
     *
     */
    set auto_broadcast(state: EntityAutoUpdateState) {
        this._auto_broadcast = state;
    }

    /**
     *
     */
    constructor(private readonly _scene: Scene) {
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
    onCreate() {}

    /**
     *
     */
    onUpdate({ elapsed_time }: { elapsed_time: number }) {}

    /**
     *
     */
    onTriggerEntered({ entity }: { entity: Entity }) {
        this.dispatchEvent(new CustomEvent("trigger-entered", { detail: { entity } }));
    }

    /**
     *
     */
    onTriggerExited({ entity }: { entity: Entity }) {
        this.dispatchEvent(new CustomEvent("trigger-exited", { detail: { entity } }));
    }

    /**
     * @internal
     */
    async _instantiate(options?: EntityCreationOptions) {
        if (this.isInstantiated()) {
            throw new Error("Entity is already instantiated");
        }

        this._proxy_state = "off";
        this.onCreate();
        const editor_entity = await this._scene._createEntity({ entity: this, options });
        this._parse({ editor_entity });
        this._scene.entity_registry.add({ entity: this });
        this._proxy_state = "on";
    }

    /**
     *
     */
    async getChildren(): Promise<Entity[]> {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }

        return await this._scene._getChildren({ entity_rtid: this.rtid });
    }

    /**
     *
     */
    async assignClientToScripts({ client_uuid }: { client_uuid: UUID }): Promise<void> {
        if (!this.rtid) {
            throw new InvalidEntityError();
        }

        if (!this.script_map || !this.script_map.elements) {
            throw new Error("Entity has no scripts");
        }
        const script_ids = Object.keys(this.script_map.elements);
        await Promise.all(
            script_ids.map(script_id =>
                this._scene._assignClientToScripts({ client_uuid, entity_rtid: this.rtid!, script_uuid: script_id }),
            ),
        );
    }

    /**
     *
     */
    toJSON() {
        let serialized: Record<string, unknown> = {};
        for (const p in this) {
            if (this._isSerializableComponent(p, this[p])) {
                serialized[p as string] = this[p];
            }
        }
        return serialized;
    }

    /**
     *
     */
    _updateFromEvent({ updated_components }: { updated_components: Record<string, unknown> }) {
        this._proxy_state = "off";
        for (const key in updated_components) {
            //@ts-ignore: the update message is guaranteed to contain only valid components
            this[key] = updated_components[key];
        }
        this._proxy_state = "on";

        this.dispatchEvent(new CustomEvent("entity-updated"));
    }

    /**
     *
     */
    _tryMarkingAsDirty({ component_type }: { component_type: ComponentType }): boolean {
        if (this.isInstantiated()) {
            // Register to appropriate dirty list
            this._scene.entity_registry._addEntityToUpdate({ component_type, entity: this });
            return true;
        }

        return false;
    }

    /**
     *
     */
    _tryMarkingAsDeleted({ component_type }: { component_type: ComponentType }): boolean {
        if (this.isInstantiated()) {
            // Register to appropriate dirty list
            this._scene.entity_registry._addEntityToUpdate({ component_type, entity: this });
            return true;
        }

        return false;
    }

    /**
     *
     */
    private _isSerializableComponent(prop: PropertyKey, v: any) {
        return (
            typeof prop === "string" &&
            v !== undefined &&
            prop[0] !== "_" &&
            Object.values(ComponentHash).includes(prop)
        );
    }

    /**
     *
     */
    static handler = {
        get(entity: Entity, prop: PropertyKey, receiver: unknown): unknown {
            const value = Reflect.get(entity, prop, receiver);
            if (
                typeof value === "function" &&
                ["addEventListener", "removeEventListener", "dispatchEvent"].includes(prop as string)
            ) {
                return value.bind(entity);
            }

            if (entity._proxy_state === "off") {
                return value;
            }

            //@ts-ignore
            if (entity._isSerializableComponent(prop, entity[prop])) {
                //console.log("GET COMPONENT", entity, prop);
                //@ts-ignore
                return new Proxy(entity[prop], new ComponentHandler(entity, prop as ComponentType));
            }

            return value;
        },

        set(entity: Entity, prop: PropertyKey, v: any): boolean {
            if (entity._proxy_state === "off") {
                return Reflect.set(entity, prop, v);
            }

            if (entity._isSerializableComponent(prop, v)) {
                //console.log("SET COMPONENT", prop, v);
                entity._tryMarkingAsDirty({ component_type: prop as ComponentType });
            }

            return Reflect.set(entity, prop, v);
        },

        deleteProperty(entity: Entity, prop: PropertyKey): boolean {
            //@ts-ignore
            if (entity[prop] === undefined) {
                return Reflect.deleteProperty(entity, prop);
            }

            //console.log("DELETE COMPONENT", prop);
            return entity._tryMarkingAsDeleted({ component_type: prop as ComponentType });
        },
    };
}

/**
 *
 */
class ComponentHandler {
    /**
     *
     */
    constructor(
        private readonly _entity: Entity,
        private readonly _component_type: ComponentType,
    ) {}

    /**
     *
     */
    get(component: object, prop: PropertyKey): unknown {
        //console.log("GET ATTRIBUTE", prop);
        //@ts-ignore
        if (prop[0] !== "_") {
            //@ts-ignore
            if ((typeof component[prop] === "object" && component[prop] !== null) || Array.isArray(component[prop])) {
                //@ts-ignore
                return new Proxy(component[prop], new ComponentHandler(this._entity, this._component_type));
            }
        }
        return Reflect.get(component, prop);
    }

    /**
     *
     */
    set(component: object, prop: PropertyKey, v: any): boolean {
        //console.log("SET ATTRIBUTE", prop, v);
        this._entity._tryMarkingAsDirty({ component_type: this._component_type });
        return Reflect.set(component, prop, v);
    }

    /**
     *
     */
    deleteProperty(component: object, prop: PropertyKey): boolean {
        //TODO: reset to default?
        //console.log("DELETE ATTRIBUTE", prop);
        return Reflect.deleteProperty(component, prop);
    }
}
