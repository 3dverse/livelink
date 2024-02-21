import { LITTLE_ENDIAN } from "../constants";
import { Mat4, deserialize_Mat4 } from "./Math";
import { RTID, UUID, deserialize_UUID } from "./common";

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
export function deserialize_FrameData({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): FrameData {
  const encoded_frame_size = dataView.getUint32(offset, LITTLE_ENDIAN);
  offset += 4;

  const meta_data_size = dataView.getUint32(offset, LITTLE_ENDIAN);
  offset += 4;

  const encoded_frame = new DataView(
    dataView.buffer,
    dataView.byteOffset + offset,
    encoded_frame_size
  );
  offset += encoded_frame_size;

  return {
    encoded_frame_size,
    meta_data_size,
    encoded_frame,
    meta_data: deserialize_FrameMetaData({ dataView, offset }),
  };
}

/**
 *
 */
export function deserialize_FrameMetaData({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): FrameMetaData {
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
    offset += 16;

    const viewport_count = dataView.getUint8(offset);
    offset += 1;

    for (let j = 0; j < viewport_count; ++j) {
      frameMetaData.clients[i].viewports.push({
        camera_rtid: BigInt(dataView.getUint32(offset, LITTLE_ENDIAN)),
        ws_from_ls: deserialize_Mat4({ dataView, offset: offset + 4 }),
      });
      offset += 4 + 16 * 4;
    }
  }

  return frameMetaData;
}
