import type { Entity } from "@livelink.base/scene/Entity";
import type { ComponentName } from "@3dverse/livelink.core";

export type ComponentHandlers = Record<ComponentName | "default", typeof ComponentHandler>;

/**
 * Proxy handler for a component value living in the entity's storage core.
 *
 * It makes the browser entity's component getters behave as before: mutating a nested property
 * (`entity.local_transform.position[0] = 5`, `entity.tags.value.push(...)`) flags the owning entity
 * dirty through the shared base's {@link EntityComponents._markComponentAsDirty}. The component value itself is
 * mutated in place, so the storage core (used for serialization) stays a plain object.
 *
 * @internal
 */
/* eslint-disable */
export class ComponentHandler {
    /**
     *
     */
    constructor(
        protected readonly _entity: Entity,
        private readonly _component_name: ComponentName,
    ) {}

    /**
     *
     */
    get(component: object, prop: PropertyKey): unknown {
        //@ts-ignore
        if (typeof component[prop] === "object" || Array.isArray(component[prop])) {
            //@ts-ignore
            return new Proxy(component[prop], new ComponentHandler(this._entity, this._component_name));
        }
        return Reflect.get(component, prop);
    }

    /**
     *
     */
    set(component: object, prop: PropertyKey, v: any): boolean {
        //console.trace("SET ATTRIBUTE", prop, v);
        const success = Reflect.set(component, prop, v);
        this._entity._markComponentAsDirty({ component_name: this._component_name });
        return success;
    }

    /**
     *
     */
    deleteProperty(component: object, prop: PropertyKey): boolean {
        //console.debug("DELETE ATTRIBUTE", prop);
        const success = Reflect.deleteProperty(component, prop);
        this._entity._markComponentAsDirty({ component_name: this._component_name });
        return success;
    }
}
