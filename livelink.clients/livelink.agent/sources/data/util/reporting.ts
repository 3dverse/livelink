/**
 * A console reporter that emits each distinct warning only once, to keep high-frequency event
 * streams from flooding the logs with the same message.
 *
 * @internal
 */
export class WarnOnceReporter {
    readonly #seen = new Set<string>();

    /**
     * Log `message` as a warning, unless a message was already logged under the same `key`.
     */
    warnOnce(key: string, message: string): void {
        if (this.#seen.has(key)) {
            return;
        }
        this.#seen.add(key);
        console.warn(message);
    }
}
