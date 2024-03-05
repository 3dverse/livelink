import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
// @ts-ignore
import BWDecoder from "../../external/Decoder.js";
// @ts-ignore
import YUVCanvas from "../../external/YUVCanvas.js";
import { CodecType, Vec2i } from "@livelink.core";

/**
 *
 */
export class SoftwareDecoder implements EncodedFrameConsumer {
  /**
   *
   */
  private _broadway_sw_decoder = new BWDecoder();
  /**
   *
   */
  private _canvas_buffer: HTMLCanvasElement = document.createElement("canvas");
  /**
   *
   */
  private _yuv_canvas: any;

  /**
   *
   */
  constructor(
    private _dimensions: Vec2i,
    private readonly _canvas_context: CanvasRenderingContext2D
  ) {}

  /**
   *
   */
  configure({ codec }: { codec: CodecType }): Promise<EncodedFrameConsumer> {
    if (codec !== CodecType.h264) {
      throw new Error("Software decoder supports only h264 encoding");
    }

    this._canvas_buffer.width = this._dimensions[0];
    this._canvas_buffer.height = this._dimensions[1];

    this._broadway_sw_decoder = new BWDecoder();
    this._broadway_sw_decoder.onPictureDecoded = this._onFrameDecoded;

    this._yuv_canvas = new YUVCanvas({
      canvas: this._canvas_buffer,
      width: this._dimensions[0],
      height: this._dimensions[1],
    });

    return Promise.resolve(this);
  }

  /**
   *
   */
  consumeFrame({ encoded_frame }: { encoded_frame: DataView }) {
    const f = new Uint8Array(
      encoded_frame.buffer,
      encoded_frame.byteOffset,
      encoded_frame.byteLength
    );
    this._broadway_sw_decoder.decode(f);
  }

  /**
   *
   */
  private _onFrameDecoded = (
    decoded_frame: any,
    width: number,
    height: number,
    infos: Array<unknown>
  ) => {
    const yDataPerRow = width;
    const yRowCnt = height;
    const uDataPerRow = width / 2;
    const uRowCnt = height / 2;

    const yChannelSize = yDataPerRow * yRowCnt;
    const uvChannelSize = uDataPerRow * uRowCnt;

    this._yuv_canvas.drawNextOutputPicture({
      yData: decoded_frame.subarray(0, yChannelSize),
      uData: decoded_frame.subarray(yChannelSize, yChannelSize + uvChannelSize),
      vData: decoded_frame.subarray(
        yChannelSize + uvChannelSize,
        yChannelSize + uvChannelSize + uvChannelSize
      ),

      yDataPerRow,
      yRowCnt,
      uDataPerRow,
      uRowCnt,
    });

    this._canvas_context?.drawImage(this._canvas_buffer, 0, 0);
  };

  /**
   *
   */
  release() {}
}
