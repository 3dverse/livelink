import { LITTLE_ENDIAN } from "./constants";

/**
 *
 */
export type Vec2 = [number, number];
/**
 *
 */
export function serialize_Vec2({ data_view, offset, v }: { data_view: DataView; offset: number; v: Vec2 }): number {
    data_view.setFloat32(offset + 0, v[0], LITTLE_ENDIAN);
    data_view.setFloat32(offset + 4, v[1], LITTLE_ENDIAN);
    return 2 * 4;
}

/**
 *
 */
export type Vec3 = [number, number, number];
/**
 *
 */
export function deserialize_Vec3({ data_view, offset }: { data_view: DataView; offset: number }): Vec3 {
    return [
        data_view.getFloat32(offset + 0, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 4, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 8, LITTLE_ENDIAN),
    ];
}

/**
 *
 */
export type Vec2i = Vec2;
/**
 *
 */
export function deserialize_Vec2i({ data_view, offset }: { data_view: DataView; offset: number }): Vec2i {
    return [data_view.getInt32(offset + 0, LITTLE_ENDIAN), data_view.getInt32(offset + 4, LITTLE_ENDIAN)];
}

/**
 *
 */
export type Vec2ui16 = Vec2;
/**
 *
 */
export function serialize_Vec2ui16({
    data_view,
    offset,
    v,
}: {
    data_view: DataView;
    offset: number;
    v: Vec2ui16;
}): number {
    data_view.setUint16(offset + 0, v[0], LITTLE_ENDIAN);
    data_view.setUint16(offset + 2, v[1], LITTLE_ENDIAN);
    return 2 * 2;
}
/**
 *
 */
export function deserialize_Vec2ui16({ data_view, offset }: { data_view: DataView; offset: number }): Vec2ui16 {
    return [data_view.getUint16(offset + 0, LITTLE_ENDIAN), data_view.getUint16(offset + 2, LITTLE_ENDIAN)];
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
    number,
];
export const MAT4_BYTE_SIZE = 64 as const;
/**
 *
 */
export function deserialize_Mat4({ data_view, offset }: { data_view: DataView; offset: number }): Mat4 {
    return [
        data_view.getFloat32(offset + 0, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 4, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 8, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 12, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 16, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 20, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 24, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 28, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 32, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 36, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 40, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 44, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 48, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 52, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 56, LITTLE_ENDIAN),
        data_view.getFloat32(offset + 60, LITTLE_ENDIAN),
    ];
}
