import { LITTLE_ENDIAN } from "../../sources/types/constants";
import {
    MAT4_BYTE_SIZE,
    Mat4,
    RTID,
    RTID_BYTE_SIZE,
    UUID,
    UUID_BYTE_SIZE,
    deserialize_Mat4,
    deserialize_UUID,
} from "../../sources/types";

/**
 *
 */
export type FrameData = {
    encoded_frame_size: number;
    meta_data_size: number;
    encoded_frame: DataView;
    meta_data: FrameMetaData;
};
/**
 *
 */
export type FrameMetaData = {
    renderer_timestamp: number;
    frame_counter: number;
    clients: Array<ClientMetaData>;
};

/**
 *
 */
export type ClientMetaData = {
    client_id: UUID;
    viewports: Array<ViewportMetaData>;
};

/**
 *
 */
type ViewportMetaData = {
    camera_rtid: RTID;
    ws_from_ls: Mat4;
};

/**
 *
 */
export function deserialize_FrameData({ dataView, offset }: { dataView: DataView; offset: number }): FrameData {
    const encoded_frame_size = dataView.getUint32(offset, LITTLE_ENDIAN);
    offset += 4;

    const meta_data_size = dataView.getUint32(offset, LITTLE_ENDIAN);
    offset += 4;

    const encoded_frame = new DataView(dataView.buffer, dataView.byteOffset + offset, encoded_frame_size);
    offset += encoded_frame_size;

    return {
        encoded_frame_size,
        meta_data_size,
        encoded_frame,
        meta_data: deserialize_FrameMetaData({
            dataView: new DataView(dataView.buffer, dataView.byteOffset + offset, meta_data_size),
            offset: 0,
        }),
    };
}

/**
 *
 */
export function deserialize_FrameMetaData({ dataView, offset }: { dataView: DataView; offset: number }): FrameMetaData {
    const VIEWPORT_SIZE = RTID_BYTE_SIZE + MAT4_BYTE_SIZE;
    const MAX_VIEWPORTS = 8;

    const frameMetaData: FrameMetaData = {
        renderer_timestamp: dataView.getUint32(offset, LITTLE_ENDIAN),
        frame_counter: dataView.getUint32(offset + 4, LITTLE_ENDIAN),
        clients: [],
    };
    offset += 8;

    const client_count = dataView.getUint8(offset);
    offset += 1;

    for (let i = 0; i < client_count; ++i) {
        frameMetaData.clients.push({
            client_id: deserialize_UUID({ dataView, offset }),
            viewports: [],
        });
        offset += UUID_BYTE_SIZE;

        const viewport_count = dataView.getUint8(offset);
        offset += 1;

        for (let j = 0; j < viewport_count; ++j) {
            frameMetaData.clients[i].viewports.push({
                camera_rtid: BigInt(dataView.getUint32(offset, LITTLE_ENDIAN)),
                ws_from_ls: deserialize_Mat4({ dataView, offset: offset + 4 }),
            });
            offset += VIEWPORT_SIZE;
        }

        offset += (MAX_VIEWPORTS - viewport_count) * VIEWPORT_SIZE;
    }

    return frameMetaData;
}
