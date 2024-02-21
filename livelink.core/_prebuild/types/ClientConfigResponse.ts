/**
 *
 */
export enum CodecType {
  h264 = 0,
  h264rgb = 1,
  h265 = 2,
}

/**
 *
 */
export type ClientConfigResponse = {
  codec: CodecType;
};

/**
 *
 */
export function deserialize_ClientConfigResponse({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): { codec: number } {
  return { codec: dataView.getUint8(0) };
}
