import { CodecType, Vec2i } from "../../_prebuild/types";

/**
 *
 */
export interface FrameDecoder {
  /**
   *
   */
  configure({
    codec,
    dimensions,
    canvas_context,
  }: {
    codec: CodecType;
    dimensions: Vec2i;
    canvas_context: CanvasRenderingContext2D;
  }): void;

  /**
   *
   */
  decodeFrame({ encoded_frame }: { encoded_frame: DataView }): void;
}
