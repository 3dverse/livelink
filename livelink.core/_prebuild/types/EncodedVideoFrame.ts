import { LITTLE_ENDIAN } from "../constants";
import { FrameMetaData, deserialize_FrameMetaData } from "./FrameMetaData";

/**
 *
 */
export type EncodedVideoFrame = {
  encoded_frame_size: number;
  meta_data_size: number;
  encoded_frame: DataView;
  meta_data: FrameMetaData;
};

/**
 *
 */
export function deserialize_EncodedVideoFrame({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): EncodedVideoFrame {
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
