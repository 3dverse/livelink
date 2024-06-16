import { LITTLE_ENDIAN } from "../../../sources/types/constants";
import { RTID, serialize_RTID } from "../../../sources/types";

/**
 *
 */
export type ViewportConfig = {
    left: number;
    top: number;
    width: number;
    height: number;
    camera_rtid: RTID;
};

/**
 *
 */
export const VIEWPORT_CONFIG_BYTE_SIZE = 20 as const;

/**
 *
 */
export function serialize_ViewportConfig({
    data_view,
    offset,
    viewportConfig,
}: {
    data_view: DataView;
    offset: number;
    viewportConfig: ViewportConfig;
}): number {
    data_view.setFloat32(offset, viewportConfig.left, LITTLE_ENDIAN);
    offset += 4;
    data_view.setFloat32(offset, viewportConfig.top, LITTLE_ENDIAN);
    offset += 4;
    data_view.setFloat32(offset, viewportConfig.width, LITTLE_ENDIAN);
    offset += 4;
    data_view.setFloat32(offset, viewportConfig.height, LITTLE_ENDIAN);
    offset += 4;

    offset += serialize_RTID({
        data_view,
        offset,
        rtid: viewportConfig.camera_rtid,
    });

    return 20;
}
