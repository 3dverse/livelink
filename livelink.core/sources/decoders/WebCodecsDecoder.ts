import { CodecType, Vec2i } from "../../_prebuild/types";
import { FrameDecoder } from "./FrameDecoder";

/**
 *
 */
export class WebCodecsDecoder implements FrameDecoder {
  /**
   *
   */
  private _decoder: VideoDecoder | null = null;

  private static _first_frame: boolean = true;
  private _canvas_context: CanvasRenderingContext2D | null = null;

  /**
   *
   */
  async configure({
    codec,
    dimensions,
    canvas_context,
  }: {
    codec: CodecType;
    dimensions: Vec2i;
    canvas_context: CanvasRenderingContext2D;
  }) {
    this._canvas_context = canvas_context;
    const config: VideoDecoderConfig = {
      codec: codec === CodecType.h264 ? "avc1.42002A" : "hvc1.1.6.L123.00",
      codedWidth: dimensions[0],
      codedHeight: dimensions[1],
      hardwareAcceleration: "prefer-hardware",
      optimizeForLatency: true,
    };

    const supportedConfig = await VideoDecoder.isConfigSupported(config);
    if (!supportedConfig.supported || !supportedConfig.config) {
      throw new Error("Codec not supported");
    }

    this._decoder = new VideoDecoder({
      output: this._onFrameDecoded,
      error: (e) => console.error(e.message),
    });

    this._decoder.configure(supportedConfig.config);
    console.log("Codec configured", supportedConfig.config);
  }

  /**
   *
   */
  decodeFrame({ encoded_frame }: { encoded_frame: DataView }) {
    const chunk = new EncodedVideoChunk({
      timestamp: 0,
      type: WebCodecsDecoder._first_frame ? "key" : "delta",
      data: new Uint8Array(
        encoded_frame.buffer,
        encoded_frame.byteOffset,
        encoded_frame.byteLength
      ),
    });

    WebCodecsDecoder._first_frame = false;
    this._decoder!.decode(chunk);
  }

  /**
   *
   */
  private _onFrameDecoded = (decoded_frame: VideoFrame) => {
    this._canvas_context!.drawImage(decoded_frame, 0, 0);
    decoded_frame.close();
  };
}
