import { LITTLE_ENDIAN } from "../../sources/types/constants";
import { RTID, serialize_RTID } from "../../sources/types";

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
export function serialize_ViewportConfig({
    dataView,
    offset,
    viewportConfig,
}: {
    dataView: DataView;
    offset: number;
    viewportConfig: ViewportConfig;
}): number {
    dataView.setFloat32(offset, viewportConfig.left, LITTLE_ENDIAN);
    offset += 4;
    dataView.setFloat32(offset, viewportConfig.top, LITTLE_ENDIAN);
    offset += 4;
    dataView.setFloat32(offset, viewportConfig.width, LITTLE_ENDIAN);
    offset += 4;
    dataView.setFloat32(offset, viewportConfig.height, LITTLE_ENDIAN);
    offset += 4;

    offset += serialize_RTID({
        dataView,
        offset,
        rtid: viewportConfig.camera_rtid,
    });

    return 20;
}
