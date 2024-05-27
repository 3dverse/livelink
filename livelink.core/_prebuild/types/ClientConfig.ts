import { Vec2i } from "../../sources/types";
import { CodecType } from "./enums";

/**
 *
 */
export type ClientConfig = {
    remote_canvas_size: Vec2i;
    encoder_config: EncoderConfig;
    supported_devices: SupportedDevices;
};

/**
 *
 */
export enum EncodingProfile {
    base = 0,
    main = 1,
    high = 2,
}

/**
 *
 */
export type EncoderConfig = {
    codec: CodecType;
    profile: EncodingProfile;
    frame_rate: number;
    lossy: boolean;
};

/**
 *
 */
export type SupportedDevices = {
    keyboard: boolean;
    mouse: boolean;
    hololens: boolean;
    gamepad: boolean;
    touchscreen: boolean;
};
