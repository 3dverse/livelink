import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
import { RawFrameMetaData } from "./RawFrameMetaData";
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
interface YUVCanvas {
    /**
     *
     */
    constructor: (_: { canvas: OffscreenCanvas; width: number; height: number }) => void;

    /**
     *
     */
    drawNextOutputPicture: (_: {
        yData: Uint8Array;
        uData: Uint8Array;
        vData: Uint8Array;
        yDataPerRow: number;
        yRowCnt: number;
        uDataPerRow: number;
        uRowCnt: number;
    }) => void;
}

/**
 * @category Streaming
 */
export class SoftwareDecoder extends EncodedFrameConsumer {
    /**
     *
     */
    #broadway_sw_decoder = new BWDecoder();
    /**
     *
     */
    #offscreen_canvas: OffscreenCanvas | null = null;
    /**
     *
     */
    #yuv_canvas: YUVCanvas | null = null;

    /**
     *
     */
    readonly #frame_consumer: DecodedFrameConsumer;

    /**
     *
     */
    constructor(frame_consumer: DecodedFrameConsumer) {
        super();
        this.#frame_consumer = frame_consumer;
    }

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

        this.#offscreen_canvas = new OffscreenCanvas(frame_dimensions[0], frame_dimensions[1]);

        this.#broadway_sw_decoder = new BWDecoder();
        this.#broadway_sw_decoder.onPictureDecoded = this._onFrameDecoded;

        this.#yuv_canvas = new YUVCanvas({
            canvas: this.#offscreen_canvas,
            width: frame_dimensions[0],
            height: frame_dimensions[1],
        });

        return Promise.resolve(this);
    }

    /**
     *
     */
    consumeEncodedFrame({ encoded_frame, meta_data }: { encoded_frame: DataView; meta_data: RawFrameMetaData }) {
        const f = new Uint8Array(encoded_frame.buffer, encoded_frame.byteOffset, encoded_frame.byteLength);
        this.#broadway_sw_decoder.decode(f, meta_data);
    }

    /**
     *
     */
    private _onFrameDecoded = (decoded_frame: Uint8Array, width: number, height: number, infos: [RawFrameMetaData]) => {
        const yDataPerRow = width;
        const yRowCnt = height;
        const uDataPerRow = width / 2;
        const uRowCnt = height / 2;

        const yChannelSize = yDataPerRow * yRowCnt;
        const uvChannelSize = uDataPerRow * uRowCnt;

        this.#yuv_canvas!.drawNextOutputPicture({
            yData: decoded_frame.subarray(0, yChannelSize),
            uData: decoded_frame.subarray(yChannelSize, yChannelSize + uvChannelSize),
            vData: decoded_frame.subarray(yChannelSize + uvChannelSize, yChannelSize + uvChannelSize + uvChannelSize),

            yDataPerRow,
            yRowCnt,
            uDataPerRow,
            uRowCnt,
        });

        const meta_data = this.applyFrameMetaData(infos[0]);

        this.#frame_consumer.consumeDecodedFrame({ decoded_frame: this.#offscreen_canvas!, meta_data });
    };

    /**
     *
     */
    release() {}
}
