//------------------------------------------------------------------------------
import type { Enums, Vec2i } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { FrameMetaData } from "./FrameMetaData";
import { EncodedFrameConsumer } from "./EncodedFrameConsumer";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";

/**
 * A decoder that uses the WebCodecs API to decode video frames.
 *
 * This decoder is hardware accelerated (if supported) and is the most efficient
 * way to decode video frames.
 *
 * This decoder is only available in browsers that support the WebCodecs API.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
 *
 * @category Streaming
 */
export class WebCodecsDecoder extends EncodedFrameConsumer {
    /**
     * Find a supported codec that can be decoded by the WebCodecs API.
     *
     * This method can be used to check if the WebCodecs API is supported by the browser.
     *
     * If the WebCodecs API is not supported, this method will return null.
     *
     * If the WebCodecs API is supported, this method will return the best codec that is supported by the browser.
     *
     * If no codec is supported by the browser, this method will return null.
     *
     * @returns The codec that is supported by the browser, or null if the WebCodecs API is not supported or no codec is supported by the browser.
     */
    public static async findSupportedCodec(): Promise<Enums.CodecType | null> {
        if (typeof VideoDecoder === "undefined") {
            console.debug("WebCodecs not supported");
            return null;
        }

        for (const codec of this.#codecs.keys()) {
            const supportedConfig = await WebCodecsDecoder.#findSupportedConfig({ codec });
            if (supportedConfig) {
                console.debug("Found a supported codec", supportedConfig.codec);
                return codec;
            }
        }

        console.debug("No supported web codec found");
        return null;
    }

    /**
     * A map of codecs supported by Livelink.core and their corresponding WebCodecs codec strings.
     */
    static get #codecs(): ReadonlyMap<Enums.CodecType, string[]> {
        return Object.freeze(
            new Map<Enums.CodecType, string[]>([
                ["h265", ["hvc1.1.6.L123.00"]],
                ["h264", ["avc1.42001E", "avc1.42002A", "avc1.42E01E", "avc1.64001f", "avc1.42002A"]],
            ]),
        );
    }

    /**
     * Find a supported configuration for the given codec and frame dimensions.
     */
    static async #findSupportedConfig({
        codec,
        frame_dimensions,
    }: {
        codec: Enums.CodecType;
        frame_dimensions?: Vec2i;
    }): Promise<VideoDecoderConfig | null> {
        if (typeof VideoDecoder === "undefined") {
            return null;
        }

        if (!WebCodecsDecoder.#codecs.has(codec)) {
            return null;
        }

        const codecs = WebCodecsDecoder.#codecs.get(codec)!;
        const config: VideoDecoderConfig = {
            codec: "",
            codedWidth: frame_dimensions?.[0],
            codedHeight: frame_dimensions?.[1],
            optimizeForLatency: true,
        };

        const hardwareAccelerations = ["prefer-hardware", "prefer-software", "no-preference"] as const;

        for (const hardwareAcceleration of hardwareAccelerations) {
            // Skipping hardware decoding for H264, as it has delay issues.
            if (codec === "h264" && hardwareAcceleration === "prefer-hardware") {
                continue;
            }

            for (const hXXX_codec of codecs) {
                config.codec = hXXX_codec;
                const supportedConfig = await VideoDecoder.isConfigSupported({ ...config, hardwareAcceleration });
                if (supportedConfig.supported && supportedConfig.config) {
                    return supportedConfig.config;
                }
            }
        }

        return null;
    }

    /**
     * The decoder instance.
     */
    #decoder: VideoDecoder | null = null;

    /**
     *
     */
    #video_decoder_config: VideoDecoderConfig | null = null;

    /**
     * A flag to indicate if the first frame has been received.
     */
    #first_frame: boolean = true;

    /**
     * A stack to store the meta data of the received frames.
     * Metadata are popped as soon as their corresponding frame is decoded.
     */
    #meta_data_stack: Array<FrameMetaData> = [];

    /**
     * A reference to the last decoded frame.
     */
    #last_frame: VideoFrame | null = null;

    /**
     * Create a new WebCodecsDecoder that will send the decoded frames to the given frame consumer.
     *
     * @param frame_consumer - The frame consumer that will receive the decoded frames
     */
    constructor({ decoded_frame_consumer }: { decoded_frame_consumer: DecodedFrameConsumer }) {
        super({ decoded_frame_consumer });
    }

    /**
     * Configure the decoder with the codec and frame dimensions.
     * This method replaces the constructor to allow for async initialization.
     */
    async configure({
        codec,
        frame_dimensions,
    }: {
        codec: Enums.CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer> {
        this.release();

        const supportedConfig = await WebCodecsDecoder.#findSupportedConfig({
            codec,
            frame_dimensions,
        });

        if (!supportedConfig) {
            throw new Error("Codec not supported");
        }

        this.#decoder = new VideoDecoder({
            output: this.#onFrameDecoded,
            error: (e): void => console.error(e.message),
        });

        this.#video_decoder_config = supportedConfig;
        this.#decoder.configure(this.#video_decoder_config);
        console.debug("Codec configured", this.#video_decoder_config);

        return this;
    }

    /**
     *
     */
    resize({ frame_dimensions }: { frame_dimensions: Vec2i }): void {
        if (this.#decoder && this.#video_decoder_config) {
            this.#video_decoder_config.codedWidth = frame_dimensions[0];
            this.#video_decoder_config.codedHeight = frame_dimensions[1];
            this.#first_frame = false;
            this.#decoder.configure(this.#video_decoder_config);
        }
    }

    /**
     * Release any resources used by the decoder.
     */
    release(): void {
        this.#last_frame?.close();
        this.#decoder?.close();
    }

    /**
     * Consume an encoded frame.
     *
     * @param params
     * @param params.encoded_frame - The encoded frame data
     * @param params.meta_data - The frame meta data
     */
    consumeEncodedFrame({ encoded_frame, meta_data }: { encoded_frame: DataView; meta_data: FrameMetaData }): void {
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
     * Called when a frame is decoded.
     */
    #onFrameDecoded = (decoded_frame: VideoFrame): void => {
        if (this.#last_frame) {
            this.#last_frame.close();
        }

        const meta_data = this.#meta_data_stack.shift()!;
        super._onFrameDecoded({ decoded_frame, meta_data });
        this.#last_frame = decoded_frame;
    };
}
