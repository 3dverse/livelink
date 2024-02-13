import { CodecType, Vec2i } from "../../_prebuild/types";
import { FrameDecoder } from "./FrameDecoder";
// @ts-ignore
import BWDecoder from "../../external/Decoder.js";
// @ts-ignore
import YUVCanvas from "../../external/YUVCanvas.js";

/**
 *
 */
export class SoftwareDecoder implements FrameDecoder {
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
  private _canvas_context: CanvasRenderingContext2D | null = null;

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
  }) {
    if (codec !== CodecType.h264) {
      throw new Error("Software decoder supports only h264 encoding");
    }

    this._canvas_buffer.width = dimensions[0];
    this._canvas_buffer.height = dimensions[1];
    this._canvas_context = canvas_context;

    this._broadway_sw_decoder = new BWDecoder();
    this._broadway_sw_decoder.onPictureDecoded = this._onFrameDecoded;

    this._yuv_canvas = new YUVCanvas({
      canvas: this._canvas_buffer,
      width: dimensions[0],
      height: dimensions[1],
    });
  }

  /**
   *
   */
  decodeFrame({ encoded_frame }: { encoded_frame: DataView }) {
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
}
