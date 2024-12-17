import { vec3 } from "gl-matrix";

import type { Viewport } from "@3dverse/livelink";
import type { Vec3 } from "@3dverse/livelink.core";

/**
 *
 */
const MOUSE_EVENTS = [
    "click",
    "mousedown",
    "mouseup",
    "mousemove",
    "mouseenter",
    "mouseleave",
    "mouseover",
    "mouseout",
    "contextmenu",
] as const;
const TOUCH_EVENTS = ["touchstart", "touchend", "touchmove", "touchcancel"] as const;
const POINTER_EVENTS = [
    "pointerover",
    "pointerenter",
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "pointerout",
    "pointerleave",
    "gotpointercapture",
    "lostpointercapture",
] as const;
const ALL_EVENTS = [...MOUSE_EVENTS, ...TOUCH_EVENTS, ...POINTER_EVENTS] as const;

/**
 *
 */
export class DOMElement {
    /**
     *
     */
    #element: HTMLElement;

    /**
     *
     */
    #cloned_elements: Map<Viewport, HTMLElement> = new Map();

    /**
     *
     */
    world_position = vec3.create() as Vec3;

    /**
     *
     */
    screen_position = vec3.create() as Vec3;

    /**
     *
     */
    scale_factor?: number;

    /**
     *
     */
    constructor({ element, scale_factor }: { element: HTMLElement; scale_factor?: number }) {
        this.#element = element;
        this.scale_factor = scale_factor;
    }

    /**
     *
     */
    getInstance({ viewport }: { viewport: Viewport }) {
        let clonedElement = this.#cloned_elements.get(viewport);

        if (!clonedElement) {
            console.info("Cloning element for viewport", viewport.camera?.id, this.#element.id);
            clonedElement = this.#element.cloneNode(true) as HTMLElement;

            for (const event of ALL_EVENTS) {
                const eventName = `on${event}`;
                //@ts-ignore
                const handler = this.#element[eventName] as GlobalEventHandlers | undefined;
                if (typeof handler === "function") {
                    //@ts-ignore
                    (clonedElement[eventName] as GlobalEventHandlers) = (event: Event) => {
                        //@ts-ignore
                        return handler(event, viewport);
                    };
                }
            }

            clonedElement.style.position = "absolute";
            if (clonedElement.id) {
                clonedElement.id = "viewport-" + viewport.camera?.id + "-" + clonedElement.id;
            }

            this.#cloned_elements.set(viewport, clonedElement);
        }

        return clonedElement;
    }

    /**
     *
     */
    propagateChangesToClones() {
        const innerHTML = this.#element.innerHTML;
        const className = this.#element.className;
        const style = this.#element.style.cssText;

        for (const cloneNode of this.#cloned_elements.values()) {
            cloneNode.innerHTML = innerHTML;
            cloneNode.className = className;
            cloneNode.style.cssText = style;
        }
    }

    /**
     *
     */
    release() {
        for (const cloneNode of this.#cloned_elements.values()) {
            if (cloneNode.parentNode != null) {
                cloneNode.parentNode.removeChild(cloneNode);
            }
        }
    }
}
