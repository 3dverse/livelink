import { CodecType } from "@livelink.core";

/**
 *
 */
export interface FrameDecoder {
  /**
   *
   */
  configure({ codec }: { codec: CodecType }): Promise<FrameDecoder>;

  /**
   *
   */
  decodeFrame({ encoded_frame }: { encoded_frame: DataView }): void;
}
