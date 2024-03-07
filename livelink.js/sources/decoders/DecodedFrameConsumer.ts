/**
 *
 */
export interface DecodedFrameConsumer {
  /**
   *
   */
  consumeDecodedFrame({ decoded_frame }: { decoded_frame: VideoFrame }): void;
}
