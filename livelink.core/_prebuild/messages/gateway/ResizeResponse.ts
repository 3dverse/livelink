import { Vec2ui16, deserialize_Vec2ui16 } from "../../../sources/types";

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
    data_view,
    offset,
}: {
    data_view: DataView;
    offset: number;
}): ResizeResponse {
    return { size: deserialize_Vec2ui16({ data_view, offset }) };
}
