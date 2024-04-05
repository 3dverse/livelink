import type { Vec2, Vec2i } from "@3dverse/livelink.core";
import { Viewport } from "./Viewport";
import { LiveLink } from "./LiveLink";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";

/**
 * To implement this we need to extract frame blitting from the decoder
 * and move it in the canvas.
 */
type RemoteCanvasSizeFitter =
  | {
      mode: "fit-to-size";
      value: "closest" | "always-inferior" | "always-superior";
    }
  | {
      mode: "align";
      value:
        | "center"
        | "top-left"
        | "top"
        | "top-right"
        | "right"
        | "bottom-right"
        | "bottom"
        | "bottom-left"
        | "left";
    };

/**
 * A canvas represents the total available area for the renderer to draw on.
 * The dimensions on this area MUST be divisble by 8 for the encoder to work
 * properly.
 * This drawing area is then split between viewports, each viewport must have
 * an associated camera.
 * Note that viewports can overlap each others.
 */
export class Canvas extends EventTarget implements DecodedFrameConsumer {
  /**
   * HTML canvas on which we display the final composited frame.
   */
  private _canvas: HTMLCanvasElement;
  /**
   *
   */
  private _context: CanvasRenderingContext2D;
  /**
   * List of viewports.
   */
  private _viewports: Array<Viewport> = [];
  /**
   * Size fitter
   */
  private _size_fitter: RemoteCanvasSizeFitter;

  /**
   * Observer for resize events.
   */
  private _observer: ResizeObserver = new ResizeObserver((e) =>
    // Cannot pass this._onResized directly as it fails to properly capture
    // 'this' once in the callback.
    this._onResized(e)
  );
  /**
   *
   */
  private _resized_promise_resolver: (() => void) | null = null;
  /**
   *
   */
  private _resized_promise: Promise<void>;
  /**
   * Debounce timeout to avoid spamming the resize command.
   */
  private _resize_debounce_timeout: number = 0;
  /**
   * Initial debounce timeout duration that gets overridden at first resize.
   */
  private _resize_debounce_timeout_duration_in_ms = 0;

  /**
   * Canvas actual dimensions.
   */
  private _dimensions: Vec2 = [300, 150];

  /**
   * Canvas actual dimensions.
   */
  private _remote_canvas_size: Vec2 = [300, 150];

  /**
   * HTML Canvas Element
   */
  get html_element() {
    return this._canvas;
  }

  /**
   * Dimensions of the HTML canvas in pixels.
   */
  get dimensions(): Vec2i {
    return [this._canvas.width, this._canvas.height];
  }

  /**
   * Dimensions of the remote canvas in pixels.
   */
  get remote_canvas_size(): Vec2i {
    return this._remote_canvas_size;
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
  constructor(
    private readonly _core: LiveLink,
    {
      canvas_element_id,
      size_fitter = { mode: "fit-to-size", value: "closest" },
    }: {
      canvas_element_id: string;
      size_fitter?: RemoteCanvasSizeFitter;
    }
  ) {
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
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (context === null) {
      throw new Error(
        `Cannot create a 2d context from canvas with id ${canvas_element_id}`
      );
    }

    this._canvas = canvas as HTMLCanvasElement;
    this._context = context;
    this._size_fitter = size_fitter;
    this._resized_promise = new Promise((resolve) => {
      this._resized_promise_resolver = resolve;
    });

    this._observer.observe(this._canvas);
    this._canvas.addEventListener("click", this._onClicked);
  }

  /**
   *
   */
  async init(): Promise<Canvas> {
    await this._resized_promise;
    // After the first resize, install the actual resize handler.
    this._sendResizeCommand = () =>
      this._core.resize({ size: this.remote_canvas_size });
    return this;
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
    viewport._onAttachedToCanvas({ canvas: this });

    // Send the command to the renderer.
    this._core.setViewports({ viewports: this._viewports });
  }

  /**
   * DecodedFrameConsumer interface
   */
  consumeDecodedFrame({ decoded_frame }: { decoded_frame: VideoFrame }): void {
    this._context.drawImage(decoded_frame, 0, 0);
  }

  /**
   * This function will be overwritten after the first resize event that
   * initializes the actual size of the canvas.
   */
  private _sendResizeCommand() {}

  /**
   * Callback called by the observer when the canvas is resized.
   */
  private _onResized(e: Array<ResizeObserverEntry>) {
    this._dimensions[0] = e[0].contentRect.width;
    this._dimensions[1] = e[0].contentRect.height;

    if (this._resize_debounce_timeout !== 0) {
      clearTimeout(this._resize_debounce_timeout);
    }

    this._resize_debounce_timeout = setTimeout(() => {
      const old_size: Vec2 = [this._canvas.width, this._canvas.height];

      this._updateCanvasSize();

      this._sendResizeCommand();

      // Resolve the init promise.
      this._resized_promise_resolver!();

      const new_size: Vec2 = [this._canvas.width, this._canvas.height];
      super.dispatchEvent(
        new CustomEvent("on-resized", { detail: { old_size, new_size } })
      );
    }, this._resize_debounce_timeout_duration_in_ms);

    // After the first timeout triggers set the following timeouts to the
    // actual duration.
    this._resize_debounce_timeout_duration_in_ms = 500;
  }

  /**
   *
   */
  private _onClicked = (e: MouseEvent) => {
    const absolute_pos: Vec2 = [e.offsetX, e.offsetY];
    const relative_pos: Vec2 = [
      absolute_pos[0] / this._remote_canvas_size[0],
      absolute_pos[1] / this._remote_canvas_size[1],
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
  private _updateCanvasSize() {
    const next_multiple_of_8 = (n: number) =>
      Math.floor(n) + (Math.floor(n) % 8 === 0 ? 0 : 8 - (Math.floor(n) % 8));

    //TODO: apply size fitter logic here
    this._canvas.width = this._dimensions[0];
    this._canvas.height = this._dimensions[1];
    this._remote_canvas_size[0] = next_multiple_of_8(this._dimensions[0]);
    this._remote_canvas_size[1] = next_multiple_of_8(this._dimensions[1]);
  }
}
