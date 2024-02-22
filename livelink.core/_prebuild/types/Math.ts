import { LITTLE_ENDIAN } from "../constants";

/**
 *
 */
export type Vec2 = [number, number];
/**
 *
 */
export function serialize_Vec2({
  dataView,
  offset,
  v,
}: {
  dataView: DataView;
  offset: number;
  v: Vec2;
}): number {
  dataView.setFloat32(offset + 0, v[0], LITTLE_ENDIAN);
  dataView.setFloat32(offset + 4, v[1], LITTLE_ENDIAN);
  return 2 * 4;
}

/**
 *
 */
export type Vec3 = [number, number, number];
/**
 *
 */
export function deserialize_Vec3({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Vec3 {
  return [
    dataView.getFloat32(offset + 0, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 4, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 8, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export type Vec2i = Vec2;
/**
 *
 */
export function deserialize_Vec2i({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Vec2i {
  return [
    dataView.getInt32(offset + 0, LITTLE_ENDIAN),
    dataView.getInt32(offset + 4, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export type Vec2ui16 = Vec2;
/**
 *
 */
export function serialize_Vec2ui16({
  dataView,
  offset,
  v,
}: {
  dataView: DataView;
  offset: number;
  v: Vec2ui16;
}): number {
  dataView.setUint16(offset + 0, v[0], LITTLE_ENDIAN);
  dataView.setUint16(offset + 2, v[1], LITTLE_ENDIAN);
  return 2 * 2;
}
/**
 *
 */
export function deserialize_Vec2ui16({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Vec2ui16 {
  return [
    dataView.getUint16(offset + 0, LITTLE_ENDIAN),
    dataView.getUint16(offset + 2, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export type Quat = [number, number, number, number];

/**
 *
 */
export type Mat4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
/**
 *
 */
export function deserialize_Mat4({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Mat4 {
  return [
    dataView.getFloat32(offset + 0, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 4, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 8, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 12, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 16, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 20, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 24, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 28, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 32, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 36, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 40, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 44, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 48, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 52, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 56, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 60, LITTLE_ENDIAN),
  ];
}
