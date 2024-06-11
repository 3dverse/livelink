export interface InputDevice {
    name: string;

    setup(): void;

    teardown(): void;
}
