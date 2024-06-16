import type { Vec2i } from "livelink.core";
import { Viewport } from "./Viewport";

/**
 * A helper class auto resizing a canvas with debouncing.
 */
export class CanvasAutoResizer extends EventTarget {
    /**
     * The viewport holding the observed canvas.
     */
    readonly #viewport: Viewport;
    /**
     * Observer for resize events.
     */
    readonly #observer: ResizeObserver;
    /**
     * Debounce timeout to avoid spamming the resize command.
     */
    #resize_debounce_timeout: number = 0;
    /**
     * Debounce timeout duration.
     */
    #resize_debounce_timeout_duration_in_ms = 500;
    /**
     * Canvas actual dimensions.
     */
    #dimensions: Vec2i;

    /**
     * Constructs an auto resizer for the provided canvas.
     */
    constructor(viewport: Viewport) {
        super();

        this.#viewport = viewport;
        this.#dimensions = [viewport.canvas.clientWidth, viewport.canvas.clientHeight];
        this.#observer = new ResizeObserver(this.#onResized);

        // My watch begins...
        this.#observer.observe(this.#viewport.canvas, { box: "device-pixel-content-box" });
    }

    /**
     *
     */
    release() {
        this.#observer.disconnect();
    }

    /**
     * Callback called by the observer when the canvas is resized.
     */
    #onResized = (_: Array<ResizeObserverEntry>): void => {
        this.#dimensions[0] = this.#viewport.canvas.clientWidth;
        this.#dimensions[1] = this.#viewport.canvas.clientHeight;

        if (this.#resize_debounce_timeout !== 0) {
            clearTimeout(this.#resize_debounce_timeout);
        }

        this.#resize_debounce_timeout = setTimeout(this.#resize, this.#resize_debounce_timeout_duration_in_ms);
    };

    /**
     * Debounced callback to actually resize the canvas and send an event.
     */
    #resize = (): void => {
        const old_size: Vec2i = [this.#viewport.canvas.width, this.#viewport.canvas.height];

        this.#viewport.canvas.width = this.#dimensions[0];
        this.#viewport.canvas.height = this.#dimensions[1];

        if (this.#viewport.canvas.width === 0 || this.#viewport.canvas.height === 0) {
            return;
        }

        if (!this.#haveDimensionsChanged(old_size, this.#viewport.dimensions)) {
            return;
        }

        this.#viewport._updateCanvasSize();

        super.dispatchEvent(
            new CustomEvent("on-resized", {
                detail: { old_size, new_size: this.#viewport.dimensions },
            }),
        );
    };

    /**
     *
     */
    #haveDimensionsChanged(old_size: Vec2i, new_size: Vec2i): boolean {
        return old_size.some((element, i) => element !== new_size[i]);
    }
}
