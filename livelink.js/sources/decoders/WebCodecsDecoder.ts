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
    static _codecs = new Map<CodecType, string[]>([
        [CodecType.h265, ["hvc1.1.6.L123.00"]],
        [CodecType.h264, ["avc1.42001E", "avc1.42002A", "avc1.42E01E"]],
    ]);

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
        const supportedConfig = await WebCodecsDecoder._findSupportedConfig({
            codec,
            frame_dimensions,
        });

        if (!supportedConfig) {
            throw new Error("Codec not supported");
        }

        this._decoder = new VideoDecoder({
            output: this._onFrameDecoded,
            error: e => console.error(e.message),
        });

        this._decoder.configure(supportedConfig.config!);
        console.log("Codec configured", supportedConfig.config);

        return this;
    }

    /**
     *
     */
    static async findAppropriatedCodec({ frame_dimensions }: { frame_dimensions: Vec2i }): Promise<CodecType | null> {
        for (const codec of this._codecs.keys()) {
            const supportedConfig = await WebCodecsDecoder._findSupportedConfig({
                codec,
                frame_dimensions,
            });

            if (supportedConfig) {
                return codec;
            }
        }

        return null;
    }

    /**
     *
     */
    private static async _findSupportedConfig({
        codec,
        frame_dimensions,
    }: {
        codec: CodecType;
        frame_dimensions: Vec2i;
    }): Promise<VideoDecoderSupport | null> {
        if (typeof VideoDecoder === "undefined") {
            return null;
        }

        if (!WebCodecsDecoder._codecs.has(codec)) {
            return null;
        }

        const codecs = WebCodecsDecoder._codecs.get(codec)!;
        const config: VideoDecoderConfig = {
            codec: "",
            codedWidth: frame_dimensions[0],
            codedHeight: frame_dimensions[1],
            // Forcing software decoding for H264, as hardware decoding with H264 has delay issues.
            hardwareAcceleration: CodecType.h264 ? "prefer-software" : "prefer-hardware",
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
            data: new Uint8Array(encoded_frame.buffer, encoded_frame.byteOffset, encoded_frame.byteLength),
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
