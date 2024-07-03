export interface InputDevice {
    name: string;

    setup(): void;

    release(): void;
}
