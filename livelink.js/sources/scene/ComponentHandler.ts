import type { Entity } from "./Entity";
import type { ComponentName } from "@3dverse/livelink.core";

import { quaternionFromEuler, quaternionToEuler } from "../maths";

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
        if ((typeof component[prop] === "object" && component[prop] !== null) || Array.isArray(component[prop])) {
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
        //console.log("DELETE ATTRIBUTE", prop);
        this._entity._markComponentAsDirty({ component_name: this._component_name });
        return Reflect.deleteProperty(component, prop);
    }
}

/**
 * CRAPCRAPCRAPCRAPCRAPCRAP ?
 */
export class LocalTransformHandler extends ComponentHandler {
    /**
     * CRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAPCRAP
     */
    get(component: object, prop: PropertyKey): unknown {
        switch (prop) {
            case "orientation": {
                const entity = this._entity;
                //@ts-ignore
                return new Proxy(component[prop], {
                    set: (target, prop, value) => {
                        const returnValue = Reflect.set(target, prop, value);
                        Reflect.set(
                            component,
                            "eulerOrientation",
                            quaternionToEuler(Reflect.get(component, "orientation")),
                        );

                        entity._markComponentAsDirty({ component_name: "local_transform" });
                        return returnValue;
                    },
                });
            }
            case "eulerOrientation": {
                const entity = this._entity;
                //@ts-ignore
                return new Proxy(component[prop], {
                    set: (target, prop, value) => {
                        const returnValue = Reflect.set(target, prop, value);
                        Reflect.set(
                            component,
                            "orientation",
                            quaternionFromEuler(Reflect.get(component, "eulerOrientation")),
                        );

                        entity._markComponentAsDirty({ component_name: "local_transform" });
                        return returnValue;
                    },
                });
            }
        }

        return super.get(component, prop);
    }

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
