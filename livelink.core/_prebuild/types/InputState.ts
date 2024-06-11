import { InputOperation } from "./enums";

/**
 *
 */
export type InputState = {
    input_operation: InputOperation;
    input_data?: Uint8Array;
};
