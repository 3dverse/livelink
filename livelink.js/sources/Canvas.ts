import type { Vec2i } from "livelink.core";
import { Viewport } from "./Viewport";

/**
 * A canvas represents the total available area for the renderer to draw on.
 * This drawing area is then split between viewports.
 * Each viewport has an associated camera that does the actual drawing.
 * Note that viewports can overlap each others.
 */
export class Canvas {
  /**
   * HTML canvas on which we display the final composited frame.
   */
  private _canvas: HTMLCanvasElement;
  /**
   * List of viewports.
   */
  private _viewports: Array<Viewport> = [];
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
   * @param canvas_element_id Element id of the canvas on which to display the final composited frame
   * @param viewports Array of viewports to attach to the canvas
   * @throws
   */
  constructor({
    canvas_element_id,
    viewports = [],
  }: {
    canvas_element_id: string;
    viewports: Array<Viewport>;
  }) {
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
}
