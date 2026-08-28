/**
 * Convert an update rate in Hz to a timer interval in milliseconds.
 *
 * Shared by every rate the SDK turns into a `setInterval`, so they all reject the same things. In
 * particular `NaN` — which `Number(process.env.SOMETHING)` produces from any bad value, and which
 * `setInterval` coerces to 0 ms, turning a configuration typo into a busy loop.
 *
 * @throws RangeError if the rate is not a finite number in the `(0, 125]` range.
 *
 * @internal
 */
export function computeIntervalInMs({ name, rate }: { name: string; rate: number }): number {
    const interval_in_ms = 1000 / rate;
    if (!Number.isFinite(interval_in_ms) || interval_in_ms < 8) {
        throw new RangeError(
            `${name} must be a finite number in the (0, 125] range so that the resulting interval` +
                ` is at least 8 ms, got ${rate}.`,
        );
    }
    return interval_in_ms;
}
