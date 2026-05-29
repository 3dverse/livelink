import { describe, expect, it } from "vitest";
import { EditionEvent } from "../sources/EditionEvent";
import type { Client } from "../sources/session/Client";

const fakeClient = {} as Client;

describe("EditionEvent", () => {
    it("isLocal() returns true when emitter is null", () => {
        const evt = new EditionEvent("test", null);
        expect(evt.isLocal()).toBe(true);
        expect(evt.isExternal()).toBe(false);
    });

    it("isExternal() returns true when emitter is a client", () => {
        const evt = new EditionEvent("test", fakeClient);
        expect(evt.isExternal()).toBe(true);
        expect(evt.isLocal()).toBe(false);
    });

    it("stores the emitter", () => {
        expect(new EditionEvent("test", fakeClient).emitter).toBe(fakeClient);
        expect(new EditionEvent("test", null).emitter).toBeNull();
    });

    it("sets the event type from the constructor argument", () => {
        expect(new EditionEvent("my-event", null).type).toBe("my-event");
    });
});
