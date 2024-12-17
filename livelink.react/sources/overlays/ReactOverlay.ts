import React, { type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import React3DElement from "./React3DElement";

import {
    CurrentFrameMetaData,
    INFINITE_FAR_VALUE,
    Vec3,
    type OverlayInterface,
    type Vec2i,
    type Viewport,
} from "@3dverse/livelink";

/**
 *
 */
export class ReactOverlay implements OverlayInterface {
    /**
     *
     */
    readonly #container: HTMLDivElement;

    /**
     *
     */
    readonly #root: Root;

    /**
     *
     */
    readonly #elements: Map<ReactElement, React3DElement> = new Map();

    /**
     *
     */
    readonly #viewport: Viewport;

    /**
     *
     */
    constructor({ container, viewport }: { container: HTMLDivElement; viewport: Viewport }) {
        this.#container = container;
        this.#root = createRoot(this.#container);
        this.#viewport = viewport;
    }

    /**
     *
     */
    addElement({ element, scale_factor }: { element: ReactElement; scale_factor?: number }) {
        if (this.#elements.has(element)) {
            console.warn(`Element already added to dom overlay`);
            return this.#elements.get(element)!;
        }

        const dom3DElement = new React3DElement({ element, scale_factor });
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
    }

    /**
     *
     */
    draw(_: { meta_data: CurrentFrameMetaData }): OffscreenCanvas | null {
        if (!this.#viewport.camera) {
            return null;
        }

        this.#root.render(this.renderElements());
        return null;
    }

    /**
     *
     */
    renderElements(): React.JSX.Element[] {
        const visibleElements: React3DElement[] = [];

        for (const react_element of this.#elements.values()) {
            const { scale, is_visible } = this.#projectElementOnScreen({ react_element });

            react_element.scale = scale;

            if (is_visible) {
                visibleElements.push(react_element);
            }
        }

        visibleElements.sort((a, b) => b.screen_position[2] - a.screen_position[2]);

        return visibleElements.map((element, z_index) => element._render({ z_index }));
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

        const is_visible = screen_position[2] < 1.0 && screen_position[2] > 0;

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

    /**
     *
     */
    release(): void {
        this.#elements.clear();
    }
}
