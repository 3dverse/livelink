import { Canvas } from "../Canvas";
import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
import { CodecType } from "@livelink.core";

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
  private _context: CanvasRenderingContext2D;

  /**
   *
   */
  private _first_frame: boolean = true;

  /**
   *
   */
  constructor(private _canvas: Canvas) {
    const context = this._canvas.html_element.getContext("2d");
    if (context === null) {
      throw new Error("Cannot create a 2d context from the provided canvas");
    }
    this._context = context;
  }

  /**
   *
   */
  async configure({
    codec,
  }: {
    codec: CodecType;
  }): Promise<EncodedFrameConsumer> {
    let supportedConfig: VideoDecoderSupport | null = null;

    const h264_codecs = ["avc1.42002A"];
    const h265_codecs = ["hvc1.1.6.L123.00"];
    const codecs = codec === CodecType.h264 ? h264_codecs : h265_codecs;
    const config: VideoDecoderConfig = {
      codec: "",
      codedWidth: this._canvas.remote_canvas_size[0],
      codedHeight: this._canvas.remote_canvas_size[1],
      hardwareAcceleration: "prefer-hardware",
      optimizeForLatency: true,
    };

    for (const hXXX_codec of codecs) {
      config.codec = hXXX_codec;
      const supported = await VideoDecoder.isConfigSupported(config);

      if (supported.supported && supported.config) {
        supportedConfig = supported;
        break;
      }
    }

    if (!supportedConfig || !supportedConfig.config) {
      throw new Error("Codec not supported");
    }

    this._decoder = new VideoDecoder({
      output: this._onFrameDecoded,
      error: (e) => console.error(e.message),
    });

    this._decoder.configure(supportedConfig.config);
    console.log("Codec configured", supportedConfig.config);

    return this;
  }

  /**
   *
   */
  consumeFrame({ encoded_frame }: { encoded_frame: DataView }) {
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
    this._context.drawImage(decoded_frame, 0, 0);
    decoded_frame.close();
  };

  /**
   *
   */
  release() {}
}
