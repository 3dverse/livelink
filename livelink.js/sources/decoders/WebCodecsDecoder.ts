import { DecodedFrameConsumer } from "./DecodedFrameConsumer";
import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
import { CodecType, Vec2i } from "@livelink.core";

/**
 *
 */
export class WebCodecsDecoder implements EncodedFrameConsumer {
  /**
   *
   */
  private _decoder: VideoDecoder | null = null;

  /**
   *
   */
  private _first_frame: boolean = true;

  /**
   *
   */
  constructor(private _frame_consumer: DecodedFrameConsumer) {}

  /**
   *
   */
  async configure({
    codec,
    frame_dimensions,
  }: {
    codec: CodecType;
    frame_dimensions: Vec2i;
  }): Promise<EncodedFrameConsumer> {
    const supportedConfig = await this._findSupportedConfig({
      codec,
      frame_dimensions,
    });

    if (!supportedConfig) {
      throw new Error("Codec not supported");
    }

    this._decoder = new VideoDecoder({
      output: this._onFrameDecoded,
      error: (e) => console.error(e.message),
    });

    this._decoder.configure(supportedConfig.config!);
    console.log("Codec configured", supportedConfig.config);

    return this;
  }

  /**
   *
   */
  private async _findSupportedConfig({
    codec,
    frame_dimensions,
  }: {
    codec: CodecType;
    frame_dimensions: Vec2i;
  }): Promise<VideoDecoderSupport | null> {
    const h264_codecs = ["avc1.42002A"];
    const h265_codecs = ["hvc1.1.6.L123.00"];
    const codecs = codec === CodecType.h264 ? h264_codecs : h265_codecs;
    const config: VideoDecoderConfig = {
      codec: "",
      codedWidth: frame_dimensions[0],
      codedHeight: frame_dimensions[1],
      hardwareAcceleration: "prefer-hardware",
      optimizeForLatency: true,
    };

    for (const hXXX_codec of codecs) {
      config.codec = hXXX_codec;
      const supportedConfig = await VideoDecoder.isConfigSupported(config);

      if (supportedConfig.supported && supportedConfig.config) {
        return supportedConfig;
      }
    }

    return null;
  }

  /**
   *
   */
  consumeEncodedFrame({ encoded_frame }: { encoded_frame: DataView }) {
    const chunk = new EncodedVideoChunk({
      timestamp: 0,
      type: this._first_frame ? "key" : "delta",
      data: new Uint8Array(
        encoded_frame.buffer,
        encoded_frame.byteOffset,
        encoded_frame.byteLength
      ),
    });

    this._first_frame = false;
    this._decoder!.decode(chunk);
  }

  /**
   *
   */
  private _onFrameDecoded = (decoded_frame: VideoFrame) => {
    this._frame_consumer.consumeDecodedFrame({ decoded_frame });
    decoded_frame.close();
  };

  /**
   *
   */
  release() {}
}
