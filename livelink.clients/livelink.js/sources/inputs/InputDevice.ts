export abstract class InputDevice {
    /**
     *
     */
    #enabled = false;

    /**
     * Enable the input device. If the device is already enabled, this method does nothing.
     */
    enable(): void {
        if (this.#enabled) {
            console.warn("Input device is already enabled");
            return;
        }

        this.#enabled = this._onEnable();
    }

    /**
     * Disable the input device. If the device is already disabled, this method does nothing.
     */
    disable(): void {
        if (!this.#enabled) {
            console.warn("Input device is already disabled");
            return;
        }

        this._onDisable();
        this.#enabled = false;
    }

    /**
     * Override this method to implement the enabling logic for the input device.
     * Should return true if the device was successfully enabled, false otherwise.
     */
    protected abstract _onEnable(): boolean;

    /**
     * Override this method to implement the disabling logic for the input device.
     */
    protected abstract _onDisable(): void;
}
