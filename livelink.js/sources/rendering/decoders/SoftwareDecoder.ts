//------------------------------------------------------------------------------
import type { CodecType, Vec2i } from "@3dverse/livelink.core";
import { DynamicLoader } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
//@ts-expect-error - Broadway is not a module
import BWDecoder from "../../../external/Decoder.js";
//@ts-expect-error - YUVCanvas is not a module
import YUVCanvas from "../../../external/YUVCanvas.js";

//------------------------------------------------------------------------------
import { FrameMetaData } from "./FrameMetaData";
import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";

/**
 * @internal
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
 * @internal
 */
interface IBWDecoder {
    /**
     *
     */
    onPictureDecoded: (_: Uint8Array, width: number, height: number, infos: [FrameMetaData]) => void;

    /**
     *
     */
    decode: (_: Uint8Array, __: FrameMetaData) => void;
}

/**
 * Software decoder that uses Broadway.js to decode h264 encoded frames.
 *
 * This decoder is not recommended for production use.
 * It is not optimized for performance.
 * It is mainly provided as a reference implementation.
 *
 * As a last resort, it can be used as a fallback when hardware decoding is not available.
 *
 * @see https://github.com/mbebenita/Broadway
 *
 * @category Streaming
 */
export class SoftwareDecoder extends EncodedFrameConsumer {
    /**
     * Broadway software decoder instance.
     */
    #broadway_sw_decoder: IBWDecoder = new BWDecoder();

    /**
     * Offscreen canvas to draw the decoded frame.
     */
    #offscreen_canvas: OffscreenCanvas | null = null;

    /**
     * YUV canvas to draw and convert the decoded frame to RGB.
     */
    #yuv_canvas: YUVCanvas | null = null;

    /**
     * Create a new software decoder.
     *
     * @param params
     * @param params.decoded_frame_consumer - The decoded frame consumer that will receive the decoded frames
     */
    constructor({ decoded_frame_consumer }: { decoded_frame_consumer: DecodedFrameConsumer }) {
        super({ decoded_frame_consumer });
    }

    /**
     * Configure the decoder with the codec and frame dimensions.
     * This method replaces the constructor to allow for async initialization.
     *
     * @param params
     * @param params.codec - The codec used to encode the frames
     * @param params.frame_dimensions - The dimensions of the frame
     *
     * @returns Returns a promise to `this` so that the method can be chained to the constructor.
     */
    configure({
        codec,
        frame_dimensions,
    }: {
        codec: CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer> {
        if (codec !== DynamicLoader.Enums.CodecType.h264) {
            throw new Error("Software decoder supports only h264 encoding");
        }

        this.#offscreen_canvas = new OffscreenCanvas(frame_dimensions[0], frame_dimensions[1]);

        this.#yuv_canvas = new YUVCanvas({
            canvas: this.#offscreen_canvas,
            width: frame_dimensions[0],
            height: frame_dimensions[1],
        });

        this.#broadway_sw_decoder.onPictureDecoded = this.#onFrameDecoded;

        return Promise.resolve(this);
    }

    /**
     * Release any resources used by the decoder.
     */
    release(): void {}

    /**
     * Consume an encoded frame.
     * Called as soon as a frame is received.
     *
     * @param params
     * @param params.encoded_frame - The encoded frame data
     * @param params.meta_data - The frame meta data
     */
    consumeEncodedFrame({ encoded_frame, meta_data }: { encoded_frame: DataView; meta_data: FrameMetaData }): void {
        const f = new Uint8Array(encoded_frame.buffer, encoded_frame.byteOffset, encoded_frame.byteLength);
        this.#broadway_sw_decoder.decode(f, meta_data);
    }

    /**
     *
     */
    #onFrameDecoded = (decoded_frame: Uint8Array, width: number, height: number, infos: [FrameMetaData]): void => {
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

        const meta_data = infos[0];
        super._onFrameDecoded({ decoded_frame: this.#offscreen_canvas!, meta_data });
    };
}
