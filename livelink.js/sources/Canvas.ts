import type { Vec2, Vec2i } from "livelink.core";
import { Viewport } from "./Viewport";

/**
 * A canvas represents the total available area for the renderer to draw on.
 * This drawing area is then split between viewports.
 * Each viewport has an associated camera that does the actual drawing.
 * Note that viewports can overlap each others.
 */
export class Canvas extends EventTarget {
  /**
   * HTML canvas on which we display the final composited frame.
   */
  private _canvas: HTMLCanvasElement;
  /**
   * List of viewports.
   */
  private _viewports: Array<Viewport> = [];
  /**
   * Observer for resize events.
   */
  private _observer: ResizeObserver = new ResizeObserver((e) =>
    // Cannot pass this._onResized directly as it fails to properly capture
    // this once in the callback.
    this._onResized(e)
  );
  /**
   * Debounce timeout to avoid spamming the resize command.
   */
  private _resize_debounce_timeout: number = 0;
  /**
   * Canvas actual dimensions.
   */
  private _dimensions: Vec2 = [350, 150];

  /**
   * HTML Canvas Element
   */
  get html_element() {
    return this._canvas;
  }

  /**
   * Width of the canvas in pixels.
   */
  get width() {
    return this._canvas.width;
  }
  /**
   * Height of the canvas in pixels.
   */
  get height() {
    return this._canvas.height;
  }

  /**
   * Height of the canvas in pixels.
   */
  get dimensions(): Vec2i {
    return [this._canvas.width, this._canvas.height];
  }

  /**
   *
   */
  get viewports() {
    return this._viewports;
  }

  /**
   * @param canvas_element_id Element id of the canvas on which to display the final composited frame
   * @param viewports Array of viewports to attach to the canvas
   *
   * @throws {InvalidCanvasId} Thrown when the provided id doesn't refer to a canvas element.
   */
  constructor({
    canvas_element_id,
    viewports = [],
  }: {
    canvas_element_id: string;
    viewports: Array<Viewport>;
  }) {
    super();

    const canvas = document.getElementById(canvas_element_id);

    if (canvas === null) {
      throw new Error(`Cannot find canvas with id ${canvas_element_id}`);
    }

    if (canvas.nodeName !== "CANVAS") {
      throw new Error(
        `HTML element with id ${canvas_element_id} is a '${canvas.nodeName}', it MUST be CANVAS`
      );
    }

    this._canvas = canvas as HTMLCanvasElement;

    for (const viewport of viewports) {
      this.attachViewport({ viewport });
    }

    this._observer.observe(this._canvas);
  }

  /**
   * Attach a viewport to the canvas
   *
   * @param viewport The viewport to attach to the canvas
   */
  attachViewport({ viewport }: { viewport: Viewport }): void {
    this._viewports.push(viewport);
    viewport._onAttachedToCanvas({ canvas: this });
  }

  /**
   * Callback called by the observer when the canvas is resized.
   */
  private _onResized(e: Array<ResizeObserverEntry>) {
    this._dimensions[0] = e[0].contentRect.width;
    this._dimensions[1] = e[0].contentRect.height;

    if (this._resize_debounce_timeout !== 0) {
      clearTimeout(this._resize_debounce_timeout);
    }

    const RESIZE_DEBOUNCE_TIMEOUT_IN_MS = 500;
    this._resize_debounce_timeout = setTimeout(() => {
      const old_size: Vec2 = [this._canvas.width, this._canvas.height];

      this._canvas.width = this._dimensions[0];
      this._canvas.height = this._dimensions[1];

      const new_size: Vec2 = [this._canvas.width, this._canvas.height];

      super.dispatchEvent(
        new CustomEvent("on-resized", { detail: { old_size, new_size } })
      );
    }, RESIZE_DEBOUNCE_TIMEOUT_IN_MS);
  }
}
