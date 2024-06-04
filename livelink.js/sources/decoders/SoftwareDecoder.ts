import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
// @ts-ignore
import BWDecoder from "../../external/Decoder.js";
// @ts-ignore
import YUVCanvas from "../../external/YUVCanvas.js";

import type { CodecType, Vec2i } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";

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
    private _offscreen_canvas: OffscreenCanvas | null = null;
    /**
     *
     */
    private _yuv_canvas: any;

    /**
     *
     */
    constructor(private readonly _frame_consumer: DecodedFrameConsumer) {}

    /**
     *
     */
    configure({
        codec,
        frame_dimensions,
    }: {
        codec: CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer> {
        if (codec !== LivelinkCoreModule.Enums.CodecType.h264) {
            throw new Error("Software decoder supports only h264 encoding");
        }

        this._offscreen_canvas = new OffscreenCanvas(frame_dimensions[0], frame_dimensions[1]);

        this._broadway_sw_decoder = new BWDecoder();
        this._broadway_sw_decoder.onPictureDecoded = this._onFrameDecoded;

        this._yuv_canvas = new YUVCanvas({
            canvas: this._offscreen_canvas,
            width: frame_dimensions[0],
            height: frame_dimensions[1],
        });

        return Promise.resolve(this);
    }

    /**
     *
     */
    consumeEncodedFrame({ encoded_frame }: { encoded_frame: DataView }) {
        const f = new Uint8Array(encoded_frame.buffer, encoded_frame.byteOffset, encoded_frame.byteLength);
        this._broadway_sw_decoder.decode(f);
    }

    /**
     *
     */
    private _onFrameDecoded = (decoded_frame: any, width: number, height: number, infos: Array<unknown>) => {
        const yDataPerRow = width;
        const yRowCnt = height;
        const uDataPerRow = width / 2;
        const uRowCnt = height / 2;

        const yChannelSize = yDataPerRow * yRowCnt;
        const uvChannelSize = uDataPerRow * uRowCnt;

        this._yuv_canvas.drawNextOutputPicture({
            yData: decoded_frame.subarray(0, yChannelSize),
            uData: decoded_frame.subarray(yChannelSize, yChannelSize + uvChannelSize),
            vData: decoded_frame.subarray(yChannelSize + uvChannelSize, yChannelSize + uvChannelSize + uvChannelSize),

            yDataPerRow,
            yRowCnt,
            uDataPerRow,
            uRowCnt,
        });

        this._frame_consumer.consumeDecodedFrame({
            decoded_frame: this._offscreen_canvas!,
        });
    };

    /**
     *
     */
    release() {}
}
