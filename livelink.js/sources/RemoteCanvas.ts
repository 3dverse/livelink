import type { Vec2, Vec2i } from "livelink.core";
import { Viewport } from "./Viewport";
import { LiveLink } from "./LiveLink";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";

/**
 * A remote canvas represents the total available area for the renderer to draw
 * on. The dimensions on this area MUST be divisble by 8 for the encoder to work
 * properly.
 * This drawing area is then split between viewports, each viewport must have
 * an associated camera.
 * Note that viewports can overlap each others.
 */
export class RemoteCanvas extends EventTarget implements DecodedFrameConsumer {
  /**
   * List of viewports.
   */
  private _viewports: Array<Viewport> = [];

  /**
   * Canvas actual dimensions.
   */
  private _dimensions: Vec2 = [0, 0];

  /**
   *
   */
  #core: LiveLink;

  /**
   *
   */
  get viewports() {
    return this._viewports;
  }

  /**
   *
   */
  constructor(core: LiveLink) {
    super();
    this.#core = core;
  }

  /**
   * Attach a viewport to the canvas
   *
   * @param viewport The viewport to attach to the canvas
   */
  attachViewport({ viewport }: { viewport: Viewport }): void {
    for (const v of this._viewports) {
      if (viewport.camera.rtid === v.camera.rtid) {
        throw new Error(
          "Cannot reference the same camera in different viewports"
        );
      }
    }

    this._viewports.push(viewport);
    // Viewports with a higher z-index should appear first to prioritize
    // consuming click events.
    this.viewports.sort((a: Viewport, b: Viewport) => {
      return a.z_index == b.z_index ? 0 : a.z_index < b.z_index ? -1 : 1;
    });

    this._computeCanvasSize();

    // Send the command to the renderer.
    this.#core.setViewports({ viewports: this._viewports });
  }

  /**
   * DecodedFrameConsumer interface
   */
  consumeDecodedFrame({ decoded_frame }: { decoded_frame: VideoFrame }): void {
    /*
    let left = 0;
    for (const viewport of this._viewports) {
      viewport.consumeDecodedFrame({ decoded_frame, left });
      left += viewport.width;
    }
    */
  }

  /**
   *
   */
  private _computeCanvasSize() {
    /*
    const next_multiple_of_8 = (n: number) =>
      Math.floor(n) + (Math.floor(n) % 8 === 0 ? 0 : 8 - (Math.floor(n) % 8));

    let width = 0;
    let height = 0;
    for (const viewport of this._viewports) {
      width += viewport.width;
      height = Math.max(height, viewport.height);
    }
    */
  }
}
