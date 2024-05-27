import { HighlightMode, ScreenSpaceRayResult, type Vec2 } from "@livelink.core";
import { Viewport } from "./Viewport";
import { LiveLink } from "./LiveLink";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";

/**
 *
 */
export class Canvas extends EventTarget {
  /**
   * The LiveLink core used to send commands.
   */
  #core: LiveLink;

  /**
   * HTML canvas on which we display the final composited frame.
   */
  private _canvas: HTMLCanvasElement;
  /**
   *
   */
  private _context: CanvasRenderingContext2D;
  /**
   *
   */
  private _auto_resizer: CanvasAutoResizer;
  /**
   * List of viewports.
   */
  private _viewports: Array<Viewport> = [];

  /**
   * HTML Canvas Element
   */
  get html_element() {
    return this._canvas;
  }

  /**
   * Dimensions of the HTML canvas in pixels.
   */
  get width(): number {
    return this._canvas.width;
  }
  get height(): number {
    return this._canvas.height;
  }
  get dimensions(): Vec2 {
    return [this.width, this.height];
  }

  /**
   *
   */
  get viewports() {
    return this._viewports;
  }

  /**
   * @param canvas_element DOM Element or id of the canvas on which to display the final composited frame
   * @param viewports Array of viewports to attach to the canvas
   *
   * @throws {InvalidCanvasId} Thrown when the provided id doesn't refer to a canvas element.
   */
  constructor(
    core: LiveLink,
    {
      canvas_element,
    }: {
      canvas_element: string | HTMLCanvasElement;
    }
  ) {
    super();
    this.#core = core;

    const canvas =
      typeof canvas_element === "string"
        ? document.getElementById(canvas_element)
        : canvas_element;

    if (canvas === null) {
      throw new Error(`Cannot find canvas ${canvas_element}`);
    }

    if (canvas.nodeName !== "CANVAS") {
      throw new Error(
        `HTML element ${canvas_element} is a '${canvas.nodeName}', it MUST be CANVAS`
      );
    }
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (context === null) {
      throw new Error(
        `Cannot create a 2d context from canvas ${canvas_element}`
      );
    }

    this._canvas = canvas as HTMLCanvasElement;
    this._auto_resizer = new CanvasAutoResizer(this);
    this._context = context;
    this._canvas.addEventListener("click", this._onClicked);
  }

  /**
   *
   */
  async init(): Promise<Canvas> {
    await this._auto_resizer.waitForFirstResize();
    return this;
  }

  /**
   * Attach a viewport to the canvas
   *
   * @param viewport The viewport to attach to the canvas
   */
  attachViewport({ viewport }: { viewport: Viewport }): void {
    this._validateCameras({ viewport });

    this._viewports.push(viewport);

    // Viewports with a higher z-index should appear first to prioritize
    // consuming click events.
    this.viewports.sort((a: Viewport, b: Viewport) => {
      return a.z_index == b.z_index ? 0 : a.z_index < b.z_index ? -1 : 1;
    });
    viewport._onAttachedToCanvas({ canvas: this });

    this.#core.remote_rendering_surface.update();
  }

  /**
   * DecodedFrameConsumer interface
   */
  consumeDecodedFrame({
    decoded_frame,
    left,
    top,
  }: {
    decoded_frame: VideoFrame;
    left: number;
    top: number;
  }): void {
    this._context.drawImage(
      decoded_frame,
      left,
      top,
      this.width,
      this.height,
      0,
      0,
      this.width,
      this.height
    );
  }

  /**
   *
   */
  async castScreenSpaceRay({
    pos,
    mode = HighlightMode.None,
  }: {
    pos: Vec2;
    mode: HighlightMode;
  }): Promise<ScreenSpaceRayResult | null> {
    for (const viewport of this._viewports) {
      if (viewport.isPointInside({ point: pos })) {
        return await this.#core!.castScreenSpaceRay({
          screenSpaceRayQuery: {
            camera_rtid: viewport.camera.rtid!,
            pos,
            mode,
          },
        });
      }
    }
    return null;
  }

  /**
   * Validates that all viewports reference different cameras.
   */
  private _validateCameras({ viewport }: { viewport: Viewport }): void {
    for (const v of this._viewports) {
      if (viewport.camera.rtid === v.camera.rtid) {
        throw new Error(
          "Cannot reference the same camera in different viewports"
        );
      }
    }
  }

  /**
   *
   */
  private _onClicked = (e: MouseEvent) => {
    const absolute_pos: Vec2 = [e.offsetX, e.offsetY];
    const relative_pos: Vec2 = [
      absolute_pos[0] / this.width,
      absolute_pos[1] / this.height,
    ];

    for (const viewport of this._viewports) {
      if (viewport.isPointInside({ point: relative_pos })) {
        viewport._onClicked({ absolute_pos, relative_pos });
        break;
      }
    }
  };

  /**
   *
   */
  updateCanvasSize() {
    this.#core.remote_rendering_surface.update();
  }
}
