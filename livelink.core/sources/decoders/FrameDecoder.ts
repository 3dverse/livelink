import { CodecType } from "../../_prebuild/types/index";

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
