import type { Entity } from "./Entity";
import type { ComponentTypeName } from "@3dverse/livelink.core";

import { quaternionFromEuler, quaternionToEuler } from "../maths";

export type ComponentHandlers = Record<ComponentTypeName | "default", typeof ComponentHandler>;

/**
 * @internal
 */
/* eslint-disable */
export class ComponentHandler {
    /**
     *
     */
    constructor(
        private readonly _entity: Entity,
        private readonly _component_type: ComponentTypeName,
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
        //console.log("DELETE ATTRIBUTE", prop);
        const defaultValue = this._entity._getComponentDefaultValue({
            component_type: this._component_type,
        }) as Record<PropertyKey, unknown>;
        this._entity._tryMarkingAsDirty({ component_type: this._component_type });

        return Reflect.set(component, prop, structuredClone(defaultValue[prop]));
    }
}

/**
 *
 */
export class LocalTransformHandler extends ComponentHandler {
    /**
     *
     */
    set(component: object, prop: PropertyKey, v: any): boolean {
        switch (prop) {
            case "orientation":
                Reflect.set(component, "eulerOrientation", quaternionToEuler(v));
                break;

            case "eulerOrientation":
                Reflect.set(component, "orientation", quaternionFromEuler(v));
                break;
        }

        return super.set(component, prop, v);
    }
}
