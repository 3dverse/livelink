import type { Vec2i } from "@3dverse/livelink.core";

/**
 * @internal
 *
 * A helper class auto resizing a canvas with debouncing.
 */
export class CanvasAutoResizer {
    /**
     * The observed canvas.
     */
    readonly #canvas: HTMLCanvasElement;

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
    #resize_debounce_timeout_duration_in_ms = 500 as const;

    /**
     * Callback to call when the canvas is resized.
     */
    #onResizedCallback: ({ old_size, new_size }: { old_size: Vec2i; new_size: Vec2i }) => void;

    /**
     * Constructs an auto resizer for the provided canvas.
     */
    constructor({
        canvas,
        onResized,
    }: {
        canvas: HTMLCanvasElement;
        onResized: ({ old_size, new_size }: { old_size: Vec2i; new_size: Vec2i }) => void;
    }) {
        this.#canvas = canvas;
        this.#observer = new ResizeObserver(this.#onResized);
        this.#onResizedCallback = onResized;

        // My watch begins...
        this.#observer.observe(this.#canvas);
    }

    /**
     *
     */
    release(): void {
        this.#observer.disconnect();
    }

    /**
     * Callback called by the observer when the canvas is resized.
     */
    #onResized = (): void => {
        if (this.#resize_debounce_timeout !== 0) {
            clearTimeout(this.#resize_debounce_timeout);
        }

        this.#resize_debounce_timeout = setTimeout(this.#resize, this.#resize_debounce_timeout_duration_in_ms);
    };

    /**
     * Debounced callback to actually resize the canvas and send an event.
     */
    #resize = (): void => {
        const old_size: Vec2i = [this.#canvas.width, this.#canvas.height];

        this.#canvas.width = this.#canvas.clientWidth;
        this.#canvas.height = this.#canvas.clientHeight;

        const new_size: Vec2i = [this.#canvas.width, this.#canvas.height];

        if (this.#canvas.width === 0 || this.#canvas.height === 0) {
            return;
        }

        if (!this.#haveDimensionsChanged(old_size, new_size)) {
            return;
        }

        this.#onResizedCallback({ old_size, new_size });
    };

    /**
     *
     */
    #haveDimensionsChanged(old_size: Vec2i, new_size: Vec2i): boolean {
        return old_size.some((element, i) => element !== new_size[i]);
    }
}
