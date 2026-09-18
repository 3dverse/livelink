import { describe, expect, it, vi } from "vitest";

import type { ActivityWatcher } from "@3dverse/livelink.core";

import { disableInactivityTimeout, MAX_INACTIVITY_TIMEOUT_SECONDS } from "../sources/inactivity";

//------------------------------------------------------------------------------
describe("disableInactivityTimeout", () => {
    it("pushes both timeouts to the longest delay a timer can hold, warning before timeout", () => {
        const watcher = { setTimeouts: vi.fn() };

        disableInactivityTimeout(watcher as unknown as ActivityWatcher);

        expect(watcher.setTimeouts).toHaveBeenCalledTimes(1);
        const [{ warn_after_seconds, timeout_after_seconds }] = watcher.setTimeouts.mock.calls[0];
        // The core refuses a warning that does not precede the timeout.
        expect(warn_after_seconds).toBeLessThan(timeout_after_seconds);
        expect(timeout_after_seconds).toBe(MAX_INACTIVITY_TIMEOUT_SECONDS);
    });

    // `setTimeout` takes a signed 32-bit delay in milliseconds: one more and Node fires it at once,
    // which would disconnect the agent immediately instead of never.
    it("never asks for a delay setTimeout cannot hold", () => {
        expect(MAX_INACTIVITY_TIMEOUT_SECONDS * 1000).toBeLessThanOrEqual(2 ** 31 - 1);
        expect((MAX_INACTIVITY_TIMEOUT_SECONDS + 1) * 1000).toBeGreaterThan(2 ** 31 - 1);
    });
});
