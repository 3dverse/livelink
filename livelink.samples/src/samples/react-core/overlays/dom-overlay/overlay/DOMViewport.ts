import { mat4, vec2 } from "gl-matrix";
import { DOMElement } from "./DOMElement";

import { INFINITE_FAR_VALUE, type Viewport } from "@3dverse/livelink";
import type { Vec3 } from "@3dverse/livelink.core";

/**
 *
 */
export class DOMViewport {
    /**
     *
     */
    #element: HTMLElement;

    /**
     *
     */
    #viewport: Viewport;

    /**
     *
     */
    projection_matrix = mat4.create();

    /**
     *
     */
    half_dimensions = vec2.create();

    /**
     *
     */
    #entity_updated_callback: (() => void) | null = null;

    /**
     *
     */
    constructor({ viewport }: { viewport: Viewport }) {
        this.#viewport = viewport;

        this.#element = document.createElement("div");
        this.#element.style.position = "absolute";
        this.#element.style.overflow = "hidden";
        this.#element.style.pointerEvents = "none";

        this.updateSize();
    }

    /**
     *
     */
    get element() {
        return this.#element;
    }

    /**
     *
     */
    updateSize() {
        this.#element.style.width = `${this.#viewport.width}px`;
        this.#element.style.height = `${this.#viewport.height}px`;
        this.#element.style.left = `${this.#viewport.offset[0]}px`;
        this.#element.style.top = `${this.#viewport.offset[1]}px`;
    }

    /**
     *
     */
    draw({ dom_elements }: { dom_elements: Array<DOMElement> }) {
        for (const dom_element of dom_elements) {
            this.#viewport.projectWorldToScreen({
                world_position: dom_element.world_position as Vec3,
                out_screen_position: dom_element.screen_position as Vec3,
            });
        }

        dom_elements.sort((a, b) => a.screen_position[2] - b.screen_position[2]);

        dom_elements.forEach((dom_element, index) => {
            const scale = dom_element.scale_factor
                ? this.#computeElementScale({
                      screen_position: dom_element.screen_position,
                      scale_factor: dom_element.scale_factor,
                  })
                : 1.0;

            const is_visible = this.#isElementVisible({ dom_element, scale });

            this.#renderHtmlElement({ dom_element, is_visible, z_index: index });
        });
    }

    /**
     *
     */
    #renderHtmlElement({
        dom_element,
        is_visible,
        z_index,
    }: {
        dom_element: DOMElement;
        is_visible: boolean;
        z_index: number;
    }) {
        const nativeDomElement = dom_element.getInstance({ viewport: this.#viewport });

        if (!is_visible) {
            if (nativeDomElement.parentNode === this.#element) {
                this.#element.removeChild(nativeDomElement);
            }
            return;
        }

        const transformStyle = `translate(-50%,-50%) translate(${dom_element.screen_position[0]}px, ${dom_element.screen_position[1]}px)`;

        nativeDomElement.style.transform = transformStyle;
        nativeDomElement.style.zIndex = z_index.toString();

        if (nativeDomElement.parentNode !== this.#element) {
            this.#element.appendChild(nativeDomElement);
        }
    }

    /**
     *
     */
    #isElementVisible({ dom_element, scale }: { dom_element: DOMElement; scale: number }): boolean {
        const shell = [dom_element.pixel_dimensions[0] * scale * 0.5, dom_element.pixel_dimensions[1] * scale * 0.5];

        return (
            dom_element.screen_position[0] > -shell[0] &&
            dom_element.screen_position[0] < this.#viewport.width + shell[0] &&
            dom_element.screen_position[1] > -shell[1] &&
            dom_element.screen_position[1] < this.#viewport.height + shell[1] &&
            dom_element.screen_position[2] < 1.0 &&
            dom_element.screen_position[2] > 0
        );
    }

    /**
     *
     */
    #computeElementScale({ screen_position, scale_factor }: { screen_position: Vec3; scale_factor: number }): number {
        const camera = this.#viewport.camera;
        if (!camera) {
            throw new Error("Viewport has no camera");
        }

        const near =
            (camera.perspective_lens ? camera.perspective_lens.nearPlane : camera.orthographic_lens?.zFar) ?? 0;
        const far =
            (camera.perspective_lens
                ? camera.perspective_lens.farPlane || INFINITE_FAR_VALUE
                : camera.orthographic_lens?.zNear) ?? 1;

        return (far - near) * (1 - screen_position[2]) * scale_factor;
    }

    /**
     *
     */
    release() {
        this.#element.remove();
        this.#viewport.camera?.removeEventListener("entity-updated", this.#entity_updated_callback);
    }
}
