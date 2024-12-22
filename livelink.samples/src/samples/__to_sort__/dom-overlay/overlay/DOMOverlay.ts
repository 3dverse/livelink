import { DOMElement } from "./DOMElement";
import { DOMViewport } from "./DOMViewport";

import type { FrameMetaData, OverlayInterface, Viewport } from "@3dverse/livelink";
import type { Vec2i } from "@3dverse/livelink.core";

/**
 *
 */
export class DOMOverlay implements OverlayInterface {
    /**
     *
     */
    #canvas: HTMLCanvasElement;

    /**
     *
     */
    #container: HTMLDivElement;

    /**
     *
     */
    #viewports: Map<Viewport, DOMViewport> = new Map();

    /**
     *
     */
    #elements: Map<HTMLElement, DOMElement> = new Map();

    /**
     *
     */
    constructor({ canvas, container }: { canvas: HTMLCanvasElement; container: HTMLDivElement }) {
        this.#canvas = canvas;
        this.#container = container;

        this.resize({ width: this.#canvas.width, height: this.#canvas.height });
    }

    /**
     *
     */
    addViewport({ viewport }: { viewport: Viewport }) {
        if (this.#viewports.has(viewport)) {
            console.warn(`Viewport already added to dom overlay`);
            return;
        }

        if (!viewport.camera) {
            console.error("Viewport has no camera", viewport);
            return;
        }

        const domViewport = new DOMViewport({ viewport });

        this.#container.appendChild(domViewport.element);
        this.#viewports.set(viewport, domViewport);
    }

    /**
     *
     */
    addElement({ element }: { element: HTMLElement }): DOMElement {
        if (this.#elements.has(element)) {
            console.warn(`Element already added to dom overlay`);
            return this.#elements.get(element)!;
        }

        const dom3DElement = new DOMElement({ element });
        this.#elements.set(element, dom3DElement);
        return dom3DElement;
    }

    /**
     *
     */
    removeElement({ element }: { element: HTMLElement }) {
        const dom3DElement = this.#elements.get(element);
        if (!dom3DElement) {
            console.warn(`Element not found in dom overlay`);
            return;
        }

        dom3DElement.release();
        this.#elements.delete(element);
    }

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void {
        this.#container.style.width = width + "px";
        this.#container.style.height = height + "px";

        for (const domViewport of this.#viewports.values()) {
            domViewport.updateSize();
        }
    }

    /**
     *
     */
    drawFrame({ viewports, meta_data }: { viewports: Viewport[]; meta_data: FrameMetaData }): null {
        const dom_elements = Array.from(this.#elements.values());
        for (const viewport of viewports) {
            if (!this.#viewports.has(viewport)) {
                continue;
            }

            const frameTransform = meta_data.current_client_camera_entities.find(
                ({ camera }) => camera === viewport.camera_projection?.camera_entity,
            );
            if (!frameTransform) {
                console.error("No metadata found for camera", viewport.camera_projection?.camera_entity);
                continue;
            }

            const dom_viewport = this.#viewports.get(viewport)!;
            dom_viewport.draw({ dom_elements });
        }

        return null;
    }

    /**
     *
     */
    release() {
        for (const dom3DElement of this.#elements.values()) {
            dom3DElement.release();
        }

        for (const domViewport of this.#viewports.values()) {
            domViewport.release();
        }

        this.#viewports.clear();
        this.#elements.clear();
    }
}
