import { EncodedFrameConsumer } from "./EncodedFrameConsumer";

import type { CodecType, Vec2i } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";

/**
 *
 */
export class WebCodecsDecoder implements EncodedFrameConsumer {
    /**
     *
     */
    private static get _codecs() {
        return Object.freeze(
            new Map<CodecType, string[]>([
                [LivelinkCoreModule.Enums.CodecType.h265, ["hvc1.1.6.L123.00"]],
                [
                    LivelinkCoreModule.Enums.CodecType.h264,
                    ["avc1.42001E", "avc1.42002A", "avc1.42E01E", "avc1.64001f", "avc1.42002A"],
                ],
            ]),
        );
    }

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
    static async findSupportedCodec(): Promise<CodecType | null> {
        if (typeof VideoDecoder === "undefined") {
            console.log("WebCodecs not supported");
            return null;
        }

        for (const codec of this._codecs.keys()) {
            const supportedConfig = await WebCodecsDecoder._findSupportedConfig({ codec });
            if (supportedConfig) {
                console.log("Found a supported codec", supportedConfig.config!.codec);
                return codec;
            }
        }

        console.log("No supported codec found");
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
        frame_dimensions?: Vec2i;
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
            codedWidth: frame_dimensions?.[0],
            codedHeight: frame_dimensions?.[1],
            optimizeForLatency: true,
        };

        const hardwareAccelerations = ["prefer-hardware", "prefer-software", "no-preference"] as const;

        for (const hardwareAcceleration of hardwareAccelerations) {
            // Skipping hardware decoding for H264, as it has delay issues.
            if (codec === LivelinkCoreModule.Enums.CodecType.h264 && hardwareAcceleration === "prefer-hardware") {
                continue;
            }

            for (const hXXX_codec of codecs) {
                config.codec = hXXX_codec;
                const supportedConfig = await VideoDecoder.isConfigSupported({ ...config, hardwareAcceleration });
                if (supportedConfig.supported && supportedConfig.config) {
                    return supportedConfig;
                }
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
        if (this.#last_frame) {
            this.#last_frame.close();
        }

        this._frame_consumer.consumeDecodedFrame({ decoded_frame });
        this.#last_frame = decoded_frame;
    };

    #last_frame: VideoFrame | null = null;

    /**
     *
     */
    release() {}
}
