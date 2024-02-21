import { LITTLE_ENDIAN } from "../constants";

/**
 *
 */
export type ViewportConfig = {
  left: number;
  top: number;
  width: number;
  height: number;
  camera_rtid: number;
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
  dataView.setFloat32(offset + 4, viewportConfig.top, LITTLE_ENDIAN);
  dataView.setFloat32(offset + 8, viewportConfig.width, LITTLE_ENDIAN);
  dataView.setFloat32(offset + 12, viewportConfig.height, LITTLE_ENDIAN);
  dataView.setUint32(offset + 16, viewportConfig.camera_rtid, LITTLE_ENDIAN);
  return 5 * 4;
}
