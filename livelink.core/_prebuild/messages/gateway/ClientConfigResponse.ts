import { CodecType } from "./enums";

/**
 *
 */
export type ClientConfigResponse = {
    codec: CodecType;
};

/**
 *
 */
export function deserialize_ClientConfigResponse({ dataView, offset }: { dataView: DataView; offset: number }): {
    codec: number;
} {
    return { codec: dataView.getUint8(0) };
}
