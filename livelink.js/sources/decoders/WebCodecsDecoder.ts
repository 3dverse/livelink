import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
import { RawFrameMetaData } from "./RawFrameMetaData";

import type { CodecType, Vec2i } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";

/**
 *
 */
export class WebCodecsDecoder extends EncodedFrameConsumer {
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
    #decoder: VideoDecoder | null = null;

    /**
     *
     */
    #first_frame: boolean = true;

    /**
     *
     */
    readonly #frame_consumer: DecodedFrameConsumer;

    /**
     *
     */
    #meta_data_stack: Array<RawFrameMetaData> = [];

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

        this.#decoder = new VideoDecoder({
            output: this._onFrameDecoded,
            error: e => console.error(e.message),
        });

        this.#decoder.configure(supportedConfig.config!);
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
    consumeEncodedFrame({ encoded_frame, meta_data }: { encoded_frame: DataView; meta_data: RawFrameMetaData }): void {
        const chunk = new EncodedVideoChunk({
            timestamp: 0,
            type: this.#first_frame ? "key" : "delta",
            data: new Uint8Array(encoded_frame.buffer, encoded_frame.byteOffset, encoded_frame.byteLength),
        });

        this.#first_frame = false;
        this.#decoder!.decode(chunk);
        this.#meta_data_stack.push(meta_data);
    }

    /**
     *
     */
    private _onFrameDecoded = (decoded_frame: VideoFrame) => {
        if (this.#last_frame) {
            this.#last_frame.close();
        }

        const raw_meta_data = this.#meta_data_stack.shift()!;
        const meta_data = this.applyFrameMetaData(raw_meta_data);

        this.#frame_consumer.consumeDecodedFrame({ decoded_frame, meta_data });
        this.#last_frame = decoded_frame;
    };

    #last_frame: VideoFrame | null = null;

    /**
     *
     */
    release() {}
}
