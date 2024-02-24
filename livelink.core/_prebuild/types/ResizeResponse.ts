import { Vec2ui16, deserialize_Vec2ui16 } from "../../sources/types/math";

/**
 *
 */
export type ResizeResponse = {
  size: Vec2ui16;
};

/**
 *
 */
export function deserialize_ResizeResponse({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): ResizeResponse {
  return { size: deserialize_Vec2ui16({ dataView, offset }) };
}
