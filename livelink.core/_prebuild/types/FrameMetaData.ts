import { LITTLE_ENDIAN } from "../constants";
import { ClientMetaData, deserialize_Mat4, deserialize_UUID } from "./common";

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
