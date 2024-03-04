import { Canvas } from "./Canvas";
import { Camera } from "./Camera";
import { Rect } from "./utils/Rect";
import { Vec2, ViewportConfig } from "@livelink.core";

/**
 *
 */
export class Viewport extends EventTarget {
  private _camera: Camera | null = null;
  private _canvas: Canvas | null = null;
  private _relative_rect: Rect;
  private _pixel_rect: Rect | null = null;
  private _z_index = 0;

  get z_index() {
    return this._z_index;
  }

  /**
   * @param {object} o
   * @param {number} o.left[0] Relative position of the leftmost side of the viewport relative to its parent canvas
   * @param {number} o.top[0] Relative position of the topmost side of the viewport relative to its parent canvas
   * @param {number} o.width[1] Relative width of the viewport relative to its parent canvas
   * @param {number} o.height[1] Relative height of the viewport relative to its parent canvas
   */
  constructor({
    camera,
    left = 0,
    top = 0,
    width = 1,
    height = 1,
    z_index = 0,
  }: {
    camera: Camera;
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    z_index?: number;
  }) {
    super();

    if (left < 0 || left >= 1) {
      throw new Error(`left MUST be in the [0,1[ range, it is ${left}`);
    }
    if (top < 0 || top >= 1) {
      throw new Error(`top MUST be in the [0,1[ range, it is ${top}`);
    }
    if (width <= 0 || width > 1) {
      throw new Error(`width MUST be in the ]0,1] range, it is ${width}`);
    }
    if (height <= 0 || height > 1) {
      throw new Error(`height MUST be in the ]0,1] range, it is ${height}`);
    }
    if (left + width > 1) {
      throw new Error(`left + width MUST be <= 1, it is ${left + width}`);
    }
    if (top + height > 1) {
      throw new Error(`top + height MUST be <= 1, it is ${top + height}`);
    }
    if (!camera.isInstantiated()) {
      throw new Error(
        `Camera '${camera.name}' MUST be instantiated before assigning it to a viewport`
      );
    }

    this._relative_rect = { left, top, width, height };
    this._z_index = z_index;
    this._camera = camera;
  }

  /**
   * Determines whether or not a point is inside the viewport.
   *
   * @param point Coordinates in pixels of the point
   * @returns true if the point is inside the viewport, false otherwise
   */
  isPointInside({ point }: { point: Vec2 }): boolean {
    return (
      point[0] >= this._relative_rect.left &&
      point[0] <= this._relative_rect.left + this._relative_rect.width &&
      point[1] >= this._relative_rect.top &&
      point[1] <= this._relative_rect.top + this._relative_rect.height
    );
    /*
    if (this._pixel_rect === null) {
      return false;
    }

    return (
      point.x >= this._pixel_rect.left &&
      point.x <= this._pixel_rect.left + this._pixel_rect.width &&
      point.y >= this._pixel_rect.top &&
      point.y <= this._pixel_rect.top + this._pixel_rect.height
    );
    */
  }

  /**
   *
   * @param camera The camera to attach to the viewport
   */
  attachCamera({ camera }: { camera: Camera }): void {
    this._camera = camera;
  }

  /**
   * The camera attached to this viewport or null if no camera is attached
   */
  get camera() {
    return this._camera;
  }

  /**
   * The canvas this viewport is attached to or null if it's not attached to any viewport
   */
  get canvas() {
    return this._canvas;
  }

  /**
   * PRIVATE
   */
  get config(): ViewportConfig {
    if (!this._camera || !this._camera.isInstantiated()) {
      throw new Error("Viewport has an invalid camera attached to it.");
    }

    return {
      left: this._relative_rect.left,
      top: this._relative_rect.top,
      width: this._relative_rect.width,
      height: this._relative_rect.height,
      camera_rtid: this._camera.rtid!,
    };
  }

  /**
   * @internal
   */
  _onClicked({
    absolute_pos,
    relative_pos,
  }: {
    absolute_pos: Vec2;
    relative_pos: Vec2;
  }) {
    relative_pos[0] =
      (relative_pos[0] - this._relative_rect.left) / this._relative_rect.width;
    relative_pos[1] =
      (relative_pos[1] - this._relative_rect.top) / this._relative_rect.height;

    console.log(relative_pos);
    this.dispatchEvent(
      new CustomEvent("on-clicked", {
        detail: { absolute_pos, relative_pos },
      })
    );
  }

  /**
   * @internal
   * @param canvas
   */
  _onAttachedToCanvas({ canvas }: { canvas: Canvas }): void {
    this._canvas = canvas;
    this._computeSizeInPixel();
  }

  /**
   *
   */
  private _computeSizeInPixel(): void {
    this._pixel_rect = {
      left: this._relative_rect.left,
      top: this._relative_rect.top,
      width: this._relative_rect.width,
      height: this._relative_rect.height,
    };
  }
}
