import type { Entity } from "./Entity";
import type { ComponentName } from "@3dverse/livelink.core";

export type ComponentHandlers = Record<ComponentName | "default", typeof ComponentHandler>;

/**
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
        this._entity._markComponentAsDirty({ component_name: this._component_name });
        return Reflect.set(component, prop, v);
    }

    /**
     *
     */
    deleteProperty(component: object, prop: PropertyKey): boolean {
        //console.debug("DELETE ATTRIBUTE", prop);
        this._entity._markComponentAsDirty({ component_name: this._component_name });
        return Reflect.deleteProperty(component, prop);
    }
}
