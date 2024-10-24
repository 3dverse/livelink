import React, { type CSSProperties, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import React3DElement from "./React3DElement";

import { INFINITE_FAR_VALUE, Vec3, type OverlayInterface, type Vec2i, type Viewport } from "@3dverse/livelink";

/**
 *
 */
export class ReactOverlay implements OverlayInterface {
    /**
     *
     */
    #container: HTMLDivElement;

    /**
     *
     */
    #root: Root;

    /**
     *
     */
    #viewports: Map<Viewport, OverlayContainer> = new Map();

    /**
     *
     */
    #elements: Map<ReactElement, React3DElement> = new Map();

    /**
     *
     */
    constructor({ container }: { container: HTMLDivElement }) {
        this.#container = container;
        this.#root = createRoot(this.#container);
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

        const domViewport = new OverlayContainer({ viewport });
        this.#viewports.set(viewport, domViewport);
    }

    /**
     *
     */
    addElement({
        element,
        pixel_dimensions,
        scale_factor,
    }: {
        element: ReactElement;
        pixel_dimensions: Vec2i;
        scale_factor?: number;
    }) {
        if (this.#elements.has(element)) {
            console.warn(`Element already added to dom overlay`);
            return this.#elements.get(element)!;
        }

        const dom3DElement = new React3DElement({ element, pixel_dimensions, scale_factor });
        this.#elements.set(element, dom3DElement);
        return dom3DElement;
    }

    /**
     *
     */
    removeElement({ element }: { element: ReactElement }) {
        const dom3DElement = this.#elements.get(element);
        if (!dom3DElement) {
            console.warn(`Element not found in dom overlay`);
            return;
        }

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
    drawFrame({ viewports }: { viewports: Viewport[] }): null {
        const jsxElements: React.JSX.Element[] = [];

        for (const viewport of viewports) {
            const react_viewport = this.#viewports.get(viewport);
            if (!react_viewport) {
                continue;
            }
            jsxElements.push(react_viewport.render({ elements: this.#elements.values() }));
        }

        this.#root.render(jsxElements);

        return null;
    }

    /**
     *
     */
    release() {
        this.#viewports.clear();
        this.#elements.clear();
    }
}

/**
 * Overlay container for a single viewport.
 */
class OverlayContainer {
    /**
     *
     */
    #viewport: Viewport;

    /**
     *
     */
    #style: CSSProperties = {};

    /**
     *
     */
    constructor({ viewport }: { viewport: Viewport }) {
        this.#viewport = viewport;

        this.updateSize();
    }

    /**
     *
     */
    updateSize() {
        this.#style = {
            position: "relative",
            overflow: "hidden",
            pointerEvents: "none",
            left: this.#viewport.offset[0],
            top: this.#viewport.offset[1],
            width: this.#viewport.width,
            height: this.#viewport.height,
        };
    }

    /**
     *
     */
    render({ elements }: { elements: Iterable<React3DElement> }) {
        const visibleElements: React3DElement[] = [];

        for (const react_element of elements) {
            const { scale, is_visible } = this.#projectElementOnScreen({ react_element });

            react_element.scale = scale;

            if (is_visible) {
                visibleElements.push(react_element);
            }
        }

        visibleElements.sort((a, b) => b.screen_position[2] - a.screen_position[2]);

        return (
            <div key={this.#viewport.camera?.id} style={this.#style}>
                {visibleElements.map((element, z_index) => element._render({ z_index }))}
            </div>
        );
    }

    /**
     *
     */
    #projectElementOnScreen({ react_element }: { react_element: React3DElement }): {
        screen_position: Vec3;
        scale: number;
        is_visible: boolean;
    } {
        const screen_position = this.#viewport.projectWorldToScreen({
            world_position: react_element.world_position as Vec3,
            out_screen_position: react_element.screen_position as Vec3,
        });

        const scale = react_element.scale_factor
            ? this.#computeElementScale({ screen_position, scale_factor: react_element.scale_factor })
            : 1.0;

        const shell = [
            react_element.pixel_dimensions[0] * scale * 0.5,
            react_element.pixel_dimensions[1] * scale * 0.5,
        ];

        const is_visible =
            screen_position[0] > -shell[0] &&
            screen_position[0] < this.#viewport.width + shell[0] &&
            screen_position[1] > -shell[1] &&
            screen_position[1] < this.#viewport.height + shell[1] &&
            screen_position[2] < 1.0 &&
            screen_position[2] > 0;

        return {
            screen_position,
            scale,
            is_visible,
        };
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
}
