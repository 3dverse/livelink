import { InputOperation } from "./enums";

/**
 *
 */
export type InputState = {
    input_operation: InputOperation;
    input_data?: Uint8Array;
};

/**
 *
 */
export function compute_InputState_size({ input_state }: { input_state: InputState }): number {
    const INPUT_HEADER_SIZE = 1;
    return INPUT_HEADER_SIZE + (input_state.input_data?.length || 0);
}

/**
 *
 */
export function serialize_InputState({
    data_view,
    offset = 0,
    input_state,
}: {
    data_view: DataView;
    offset?: number;
    input_state: InputState;
}): number {
    data_view.setUint8(offset, input_state.input_operation);
    offset += 1;

    if (input_state.input_data) {
        for (let i = 0; i < input_state.input_data.length; ++i) {
            data_view.setUint8(offset++, input_state.input_data[i]);
        }
    }

    return compute_InputState_size({ input_state });
}
