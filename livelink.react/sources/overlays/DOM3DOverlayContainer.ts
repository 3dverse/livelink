//------------------------------------------------------------------------------
import type { Mat4, OverlayInterface, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { DOM3DElementProjection } from "./DOM3DElementProjection";
import { epsilon } from "../components/utils/math";

/**
 * @internal
 */
export class DOM3DOverlayContainer implements OverlayInterface {
    /**
     *
     */
    readonly container: HTMLDivElement;

    /**
     *
     */
    readonly #elements: Set<DOM3DElementProjection> = new Set();

    /**
     *
     */
    readonly #viewport: Viewport;

    /**
     *
     */
    get dom_3d_element(): HTMLDivElement {
        return this.#camera_transform_element;
    }

    /**
     *
     */
    #camera_projection_element: HTMLDivElement;

    /**
     *
     */
    #camera_transform_element: HTMLDivElement;

    /**
     *
     */
    #client_rect: DOMRect;

    /**
     *
     */
    constructor({
        container,
        camera_projection_element,
        camera_transform_element,
        viewport,
    }: {
        container: HTMLDivElement;
        camera_projection_element: HTMLDivElement;
        camera_transform_element: HTMLDivElement;
        viewport: Viewport;
    }) {
        this.container = container;
        this.#client_rect = this.container.getBoundingClientRect();
        this.#camera_projection_element = camera_projection_element;
        this.#camera_transform_element = camera_transform_element;
        this.#viewport = viewport;
    }

    /**
     * @internal
     */
    _registerElement(dom3d_element: DOM3DElementProjection): void {
        this.#elements.add(dom3d_element);
        this.#viewport.rendering_surface.redrawLastFrame();
    }

    /**
     * @internal
     */
    _unregisterElement(dom3d_element: DOM3DElementProjection): void {
        if (!this.#elements.delete(dom3d_element)) {
            console.warn(`Element ref not found in dom overlay`);
        }
    }

    /**
     *
     */
    _redraw(): void {
        this.#viewport.rendering_surface.redrawLastFrame();
    }

    /**
     *
     */
    resize(_: { width: number; height: number }): void {
        this.#client_rect = this.container.getBoundingClientRect();
    }

    /**
     *
     */
    draw(): OffscreenCanvas | null {
        if (!this.#viewport.isValid()) {
            return null;
        }

        this.computeStyles();
        this.updateElements();
        return null;
    }

    /**
     *
     */
    computeStyles(): void {
        if (!this.#viewport.camera_projection) {
            return;
        }

        const cameraCSSMatrix = getCameraCSSMatrix(this.#viewport.camera_projection.view_from_world_matrix);

        const halfClientWidth = this.#client_rect.width / 2;
        const halfClientHeight = this.#client_rect.height / 2;

        if (this.#viewport.camera_projection.is_perspective()) {
            const fov = this.#viewport.camera_projection.clip_from_view_matrix[5] * halfClientHeight;

            this.#camera_projection_element.style.perspective = `${fov}px`;
            this.#camera_transform_element.style.transform = `translateZ(${fov}px) ${cameraCSSMatrix} translate(${halfClientWidth}px, ${halfClientHeight}px)`;
        }
    }

    /**
     *
     */
    updateElements(): void {
        for (const dom3d_element of this.#elements.values()) {
            dom3d_element.updateProjection({ viewport: this.#viewport });
        }
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

function getCameraCSSMatrix(matrix: Readonly<Mat4>): string {
    return (
        "matrix3d(" +
        epsilon(matrix[0]) +
        "," +
        epsilon(-matrix[1]) +
        "," +
        epsilon(matrix[2]) +
        "," +
        epsilon(matrix[3]) +
        "," +
        epsilon(matrix[4]) +
        "," +
        epsilon(-matrix[5]) +
        "," +
        epsilon(matrix[6]) +
        "," +
        epsilon(matrix[7]) +
        "," +
        epsilon(matrix[8]) +
        "," +
        epsilon(-matrix[9]) +
        "," +
        epsilon(matrix[10]) +
        "," +
        epsilon(matrix[11]) +
        "," +
        epsilon(matrix[12]) +
        "," +
        epsilon(-matrix[13]) +
        "," +
        epsilon(matrix[14]) +
        "," +
        epsilon(matrix[15]) +
        ")"
    );
}
