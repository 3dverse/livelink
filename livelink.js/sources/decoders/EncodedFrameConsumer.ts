import { CodecType } from "@livelink.core";

/**
 *
 */
export interface EncodedFrameConsumer {
  /**
   *
   */
  configure({ codec }: { codec: CodecType }): Promise<EncodedFrameConsumer>;

  /**
   *
   */
  consumeFrame({ encoded_frame }: { encoded_frame: DataView }): void;

  /**
   *
   */
  release(): void;
}
