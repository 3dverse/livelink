import { describe, it, expect, vi } from "vitest";
import { TypedEventTarget } from "../sources/TypedEventTarget";

type TestEvents = {
    "on-foo": MessageEvent<string>;
    "on-bar": MessageEvent<number>;
};

function makeFooEvent(data: string): MessageEvent<string> {
    return new MessageEvent<string>("on-foo", { data });
}

describe("TypedEventTarget", () => {
    it("calls a registered listener when the matching event is dispatched", () => {
        const target = new TypedEventTarget<TestEvents>();
        const handler = vi.fn();

        target.addEventListener("on-foo", handler);
        target._dispatchEvent(makeFooEvent("hello"));

        expect(handler).toHaveBeenCalledOnce();
    });

    it("does not call a listener after it is removed", () => {
        const target = new TypedEventTarget<TestEvents>();
        const handler = vi.fn();

        target.addEventListener("on-foo", handler);
        target.removeEventListener("on-foo", handler);
        target._dispatchEvent(makeFooEvent("hello"));

        expect(handler).not.toHaveBeenCalled();
    });

    it("does not call a listener registered for a different event", () => {
        const target = new TypedEventTarget<TestEvents>();
        const fooHandler = vi.fn();

        target.addEventListener("on-foo", fooHandler);
        target._dispatchEvent(new MessageEvent<number>("on-bar", { data: 42 }));

        expect(fooHandler).not.toHaveBeenCalled();
    });

    it("calls multiple listeners registered for the same event", () => {
        const target = new TypedEventTarget<TestEvents>();
        const first = vi.fn();
        const second = vi.fn();

        target.addEventListener("on-foo", first);
        target.addEventListener("on-foo", second);
        target._dispatchEvent(makeFooEvent("hello"));

        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });

    it("only removes the specific listener passed to removeEventListener", () => {
        const target = new TypedEventTarget<TestEvents>();
        const first = vi.fn();
        const second = vi.fn();

        target.addEventListener("on-foo", first);
        target.addEventListener("on-foo", second);
        target.removeEventListener("on-foo", first);
        target._dispatchEvent(makeFooEvent("hello"));

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
    });

    it("returns true when an event is dispatched with a listener", () => {
        const target = new TypedEventTarget<TestEvents>();
        target.addEventListener("on-foo", () => {});

        const result = target._dispatchEvent(makeFooEvent("hello"));

        expect(result).toBe(true);
    });
});
