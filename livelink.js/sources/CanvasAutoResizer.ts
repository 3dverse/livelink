import type { Vec2i, Vec2 } from "livelink.core";
import { Viewport } from "./Viewport";

/**
 * At loading time HTML Canvases are always initialized with a default size
 * of 300x150, then it gets resized to the actual size of the canvas as specified
 * by the web page.
 * To avoid sending a wrong size to the renderer, this helper class implements
 * a ResizeObserver and provides a way to wait for the initial resize.
 */
export class CanvasAutoResizer extends EventTarget {
    /**
     * Observer for resize events.
     */
    private _observer: ResizeObserver;
    /**
     * Debounce timeout to avoid spamming the resize command.
     */
    private _resize_debounce_timeout: number = 0;
    /**
     * Debounce timeout duration.
     */
    private _resize_debounce_timeout_duration_in_ms = 500;
    /**
     * Canvas actual dimensions. As mentionned initialy all canvases have this
     * default size of 300x150 pixels.
     */
    private _dimensions: Vec2;

    /**
     * Constructs an auto resizer for the provided canvas.
     */
    constructor(private readonly _viewport: Viewport) {
        super();

        this._dimensions = [_viewport.canvas.clientWidth, _viewport.canvas.clientHeight];

        // Cannot pass this._onResized directly as it fails to properly capture
        // 'this' once in the callback.
        this._observer = new ResizeObserver(e => this._onResized(e));

        // My watch begins...
        this._observer.observe(this._viewport.canvas, { box: "device-pixel-content-box" });
    }

    /**
     *
     */
    release() {
        this._observer.disconnect();
    }

    /**
     * Callback called by the observer when the canvas is resized.
     */
    private _onResized(e: Array<ResizeObserverEntry>) {
        this._dimensions[0] = this._viewport.canvas.clientWidth;
        this._dimensions[1] = this._viewport.canvas.clientHeight;

        if (this._resize_debounce_timeout !== 0) {
            clearTimeout(this._resize_debounce_timeout);
        }

        this._resize_debounce_timeout = setTimeout(() => this._resize(), this._resize_debounce_timeout_duration_in_ms);
    }

    /**
     * Resize the canvas and send an event.
     */
    private _resize() {
        const old_size: Vec2 = [this._viewport.canvas.width, this._viewport.canvas.height];

        this._viewport.canvas.width = this._dimensions[0];
        this._viewport.canvas.height = this._dimensions[1];

        if (this._viewport.canvas.width === 0 || this._viewport.canvas.height === 0) {
            return;
        }

        if (!this._haveDimensionsChanged(old_size, this._viewport.dimensions)) {
            return;
        }

        this._viewport._updateCanvasSize();

        super.dispatchEvent(
            new CustomEvent("on-resized", {
                detail: { old_size, new_size: this._viewport.dimensions },
            }),
        );
    }

    /**
     *
     */
    private _haveDimensionsChanged(old_size: Vec2i, new_size: Vec2i): boolean {
        return old_size.some((element, i) => element !== new_size[i]);
    }
}
