import type { Vec2, Vec2ui16, ViewportConfig } from "livelink.core";
import { Viewport } from "./Viewport";
import { LiveLink } from "./LiveLink";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";
import { Canvas } from "./Canvas";

type CanvasHolder = {
  canvas: Canvas;
  offset: Vec2;
};

/**
 * A remote rendering surface represents the total available area for the remote
 * renderer to draw on.
 * The dimensions of this surface MUST be divisble by 8 for the encoder to work
 * properly.
 * This drawing area is split into canvases which in turn are split into
 * viewports, each viewport must have an associated camera.
 * Note that canvases can not overlap but viewports can.
 */
export class RemoteRenderingSurface implements DecodedFrameConsumer {
  /**
   * List of canvases.
   */
  private _canvases: Array<CanvasHolder> = [];

  /**
   * Surface actual dimensions.
   */
  private _dimensions: Vec2ui16 = [0, 0];

  /**
   * Current offset to apply to the next
   */
  private _current_offset = 0;

  /**
   *
   */
  #core: LiveLink;

  /**
   *
   */
  get dimensions(): Vec2ui16 {
    return this._dimensions;
  }

  /**
   *
   */
  get viewports(): Array<Viewport> {
    let viewports: Array<Viewport> = [];
    for (const c of this._canvases) {
      viewports = viewports.concat(c.canvas.viewports);
    }
    return viewports;
  }

  /**
   *
   */
  constructor(core: LiveLink) {
    this.#core = core;
  }

  /**
   *
   */
  consumeDecodedFrame({ decoded_frame }: { decoded_frame: VideoFrame }): void {
    for (const c of this._canvases) {
      c.canvas.consumeDecodedFrame({
        decoded_frame,
        left: c.offset[0],
        top: c.offset[1],
      });
    }
  }

  /**
   * Attach a canvas to the surface
   *
   * @param canvas The canvas to attach to the surface
   */
  addCanvas({ canvas }: { canvas: Canvas }): void {
    this._canvases.push({ canvas, offset: [this._current_offset, 0] });
    this._current_offset += canvas.width;
    this.update();
  }

  /**
   *
   */
  update(): void {
    const need_to_resize = this._computeSurfaceSize();

    if (this.#core.isConfigured()) {
      this.#core.setViewports({ viewports: this.viewports });

      if (need_to_resize) {
        this.#core.resize({ size: this._dimensions });
      }
    }
  }

  /**
   *
   */
  private _computeSurfaceSize(): boolean {
    const next_multiple_of_8 = (n: number) =>
      Math.floor(n) + (Math.floor(n) % 8 === 0 ? 0 : 8 - (Math.floor(n) % 8));

    let width = 0;
    let height = 0;

    for (const c of this._canvases) {
      width += c.canvas.width;
      height = Math.max(height, c.canvas.height);
    }

    const new_dimensions: Vec2 = [
      next_multiple_of_8(width),
      next_multiple_of_8(height),
    ];

    const need_to_resize =
      new_dimensions[0] != this._dimensions[0] ||
      new_dimensions[1] != this.dimensions[1];

    this._dimensions = new_dimensions;

    return need_to_resize;
  }
}
