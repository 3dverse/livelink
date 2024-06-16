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
export function deserialize_ClientConfigResponse({ data_view, offset }: { data_view: DataView; offset: number }): {
    codec: number;
} {
    return { codec: data_view.getUint8(0) };
}
