import { CodecType, Vec2i } from "../../_prebuild/types";

/**
 *
 */
export interface FrameDecoder {
  /**
   *
   */
  configure({ codec }: { codec: CodecType }): void;

  /**
   *
   */
  decodeFrame({ encoded_frame }: { encoded_frame: DataView }): void;
}
