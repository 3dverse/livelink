import { describe, it, expect, vi } from "vitest";

import { ObservedEventTarget } from "../sources/ObservedEventTarget";

//------------------------------------------------------------------------------
// What this class adds over the shared TypedEventTarget is one question — "is anybody listening?" —
// which SceneIngestion asks before letting an error vanish. The listener bookkeeping behind it has
// to survive the two ways a listener leaves without calling removeEventListener: `once` and an
// aborted signal.
//------------------------------------------------------------------------------

type TestEvents = {
    "on-foo": MessageEvent<string>;
    "on-bar": MessageEvent<number>;
};

function makeFooEvent(data: string): MessageEvent<string> {
    return new MessageEvent<string>("on-foo", { data });
}

/**
 * `_hasListeners` is protected — a subclass is how an emitter actually reaches it.
 */
class Target extends ObservedEventTarget<TestEvents> {
    hasListeners(event_name: keyof TestEvents & string): boolean {
        return this._hasListeners(event_name);
    }
}

describe("ObservedEventTarget", () => {
    it("reports whether an event is observed, per event name", () => {
        const target = new Target();
        const handler = vi.fn();

        expect(target.hasListeners("on-foo")).toBe(false);

        target.addEventListener("on-foo", handler);
        expect(target.hasListeners("on-foo")).toBe(true);
        expect(target.hasListeners("on-bar")).toBe(false);

        target.removeEventListener("on-foo", handler);
        expect(target.hasListeners("on-foo")).toBe(false);
    });

    it("still dispatches to its listeners, like the target it extends", () => {
        const target = new Target();
        const first = vi.fn();
        const second = vi.fn();

        target.addEventListener("on-foo", first);
        target.addEventListener("on-foo", second);
        target._dispatchEvent(makeFooEvent("hello"));

        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });

    it("counts the same listener once, however many times it is added", () => {
        const target = new Target();
        const handler = vi.fn();

        target.addEventListener("on-foo", handler);
        target.addEventListener("on-foo", handler);
        target.removeEventListener("on-foo", handler);

        expect(target.hasListeners("on-foo")).toBe(false);
        target._dispatchEvent(makeFooEvent("hello"));
        expect(handler).not.toHaveBeenCalled();
    });

    it("ignores removing a listener that was never added, instead of drifting", () => {
        const target = new Target();
        const registered = vi.fn();

        target.addEventListener("on-foo", registered);
        target.removeEventListener("on-foo", vi.fn());

        expect(target.hasListeners("on-foo")).toBe(true);
    });

    it("stops counting a `once` listener after it has fired", () => {
        const target = new Target();
        const handler = vi.fn();

        target.addEventListener("on-foo", handler, { once: true });
        expect(target.hasListeners("on-foo")).toBe(true);

        target._dispatchEvent(makeFooEvent("hello"));

        expect(handler).toHaveBeenCalledOnce();
        expect(target.hasListeners("on-foo")).toBe(false);

        // The underlying target dropped it too: a second dispatch reaches nobody.
        target._dispatchEvent(makeFooEvent("again"));
        expect(handler).toHaveBeenCalledOnce();
    });

    it("stops counting a listener whose abort signal fired", () => {
        const target = new Target();
        const controller = new AbortController();
        const handler = vi.fn();

        target.addEventListener("on-foo", handler, { signal: controller.signal });
        expect(target.hasListeners("on-foo")).toBe(true);

        controller.abort();

        expect(target.hasListeners("on-foo")).toBe(false);
        target._dispatchEvent(makeFooEvent("hello"));
        expect(handler).not.toHaveBeenCalled();
    });
});
