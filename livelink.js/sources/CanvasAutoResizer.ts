import { type Vec2 } from "@livelink.core";
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
     * The promise that's getting resolved after the first initial resize event.
     */
    private _resized_promise: Promise<void>;
    /**
     * The captured resolve callback of the promise.
     */
    private _resized_promise_resolver: (() => void) | null = null;
    /**
     * Debounce timeout to avoid spamming the resize command.
     */
    private _resize_debounce_timeout: number = 0;
    /**
     * Initial debounce timeout duration that gets overridden at first resize.
     */
    private _resize_debounce_timeout_duration_in_ms = 0;
    /**
     * Canvas actual dimensions. As mentionned initialy all canvases have this
     * default size of 300x150 pixels.
     */
    private _dimensions: Vec2 = [300, 150];

    /**
     * Constructs an auto resizer for the provided canvas.
     */
    constructor(private readonly _viewport: Viewport) {
        super();

        this._resized_promise = new Promise(resolve => {
            this._resized_promise_resolver = resolve;
        });

        // Cannot pass this._onResized directly as it fails to properly capture
        // 'this' once in the callback.
        this._observer = new ResizeObserver(e => this._onResized(e));

        // My watch begins...
        this._observer.observe(this._viewport.canvas, { box: "device-pixel-content-box" });
    }

    /**
     * This promise resolves once the canvas has been properly resized to its
     * actual initial size as defined by the web page.
     */
    async waitForFirstResize(): Promise<void> {
        await this._resized_promise;

        // Overwrite the notifier now that we have initialized our real size.
        this._notifyViewport = () => this._viewport.updateCanvasSize();
    }

    /**
     * This function will be overwritten after the first resize event that
     * initializes the actual size of the canvas.
     */
    private _notifyViewport() {}

    /**
     * Callback called by the observer when the canvas is resized.
     */
    private _onResized(e: Array<ResizeObserverEntry>) {
        this._dimensions[0] = e[0].devicePixelContentBoxSize[0].inlineSize;
        this._dimensions[1] = e[0].devicePixelContentBoxSize[0].blockSize;

        if (this._resize_debounce_timeout !== 0) {
            clearTimeout(this._resize_debounce_timeout);
        }

        this._resize_debounce_timeout = setTimeout(() => this._resize(), this._resize_debounce_timeout_duration_in_ms);

        // After the first timeout triggers set the following timeouts to the
        // actual duration.
        this._resize_debounce_timeout_duration_in_ms = 500;
    }

    /**
     * Resize the canvas and send an event.
     */
    private _resize() {
        const old_size: Vec2 = [this._viewport.canvas.width, this._viewport.canvas.height];

        this._viewport.canvas.width = this._dimensions[0] * devicePixelRatio;
        this._viewport.canvas.height = this._dimensions[1] * devicePixelRatio;

        this._notifyViewport();

        // Resolve the init promise.
        this._resized_promise_resolver!();

        super.dispatchEvent(
            new CustomEvent("on-resized", {
                detail: { old_size, new_size: this._viewport.dimensions },
            }),
        );
    }
}
