//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { Vec3, OverlayInterface, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { React3DElement, React3DElementProps, createReact3DElementFactory } from "./React3DElement";

/**
 *
 */
const INFINITE_FAR_VALUE = 100000;

/**
 *
 */
export type Projection = {
    screen_position: Vec3;
    scale: number;
    is_visible: boolean;
};

/**
 *
 */
export class ReactOverlay implements OverlayInterface {
    /**
     *
     */
    readonly container: HTMLDivElement;

    /**
     *
     */
    readonly #elements: Set<React3DElement> = new Set();

    /**
     *
     */
    readonly #viewport: Viewport;

    /**
     *
     */
    readonly #factory: (props: React3DElementProps) => React.ReactElement;

    /**
     *
     */
    constructor({ container, viewport }: { container: HTMLDivElement; viewport: Viewport }) {
        this.container = container;
        this.#viewport = viewport;
        this.#factory = createReact3DElementFactory(this);
    }

    /**
     *
     */
    get DOM3DElement(): (props: React3DElementProps) => React.ReactElement {
        return this.#factory;
    }

    /**
     * @internal
     */
    _registerElement(react_element: React3DElement): void {
        this.#elements.add(react_element);
        this.#viewport.rendering_surface.redrawLastFrame();
    }

    /**
     * @internal
     */
    _unregisterElement(react_element: React3DElement): void {
        if (!this.#elements.delete(react_element)) {
            console.warn(`Element ref not found in dom overlay`);
        }
    }

    _updateElement(): void {
        this.#viewport.rendering_surface.redrawLastFrame();
    }

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void {
        this.container.style.width = width + "px";
        this.container.style.height = height + "px";
    }

    /**
     *
     */
    draw(): OffscreenCanvas | null {
        if (!this.#viewport.isValid()) {
            return null;
        }

        this.updateElements();
        return null;
    }

    /**
     *
     */
    updateElements(): void {
        const elements: Array<{
            projection: Projection;
            react_element: React3DElement;
        }> = [];

        for (const react_element of this.#elements.values()) {
            const projection = this.#projectElementOnScreen({ react_element });
            elements.push({ projection, react_element });
        }

        elements.sort((a, b) => b.projection.screen_position[2] - a.projection.screen_position[2]);
        elements.forEach(({ projection, react_element }, z_index) => {
            react_element.setProjection({ ...projection, z_index });
        });
    }

    /**
     *
     */
    #projectElementOnScreen({ react_element }: { react_element: React3DElement }): Projection {
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
        const camera = this.#viewport.camera_projection?.camera_entity;
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
        // We need to unmount the root in the next event loop
        // iteration to avoid unmounting the root while rendering.
        setTimeout(() => {
            this.#elements.clear();
        }, 0);
    }
}
