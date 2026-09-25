import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` below is hoisted above this import by vitest, so the transport sees the fake `mqtt`.
import { MqttTransport, type MqttTransportConfig } from "../sources/data/transports/MqttTransport";
import type { EventSink } from "../sources/data/Transport";

//------------------------------------------------------------------------------
/**
 * A stand-in for an `mqtt` client: records what it was subscribed to and lets a test emit the
 * events a real client would.
 */
class FakeClient extends EventEmitter {
    readonly subscriptions: Array<string> = [];
    ended = false;

    constructor(readonly options: Record<string, unknown>) {
        super();
    }

    subscribe(topic: string): void {
        this.subscriptions.push(topic);
    }

    end(): void {
        this.ended = true;
    }
}

//------------------------------------------------------------------------------
// What the fake `connect` was called with, in order. Reset per test.
const connected: Array<{ url: string | undefined; options: Record<string, unknown>; client: FakeClient }> = [];
let next_id = 0;

//------------------------------------------------------------------------------
// The fake keeps the real module's one surprising trait: the options object it is handed becomes
// the client's live options, and a `clientId` is written into it when there is none. That is the
// behaviour the copy in `MqttTransport.start` exists for, and what these tests pin.
vi.mock("mqtt", () => ({
    connect: (
        url_or_options: string | Record<string, unknown>,
        maybe_options?: Record<string, unknown>,
    ): FakeClient => {
        const url = typeof url_or_options === "string" ? url_or_options : undefined;
        const options = (typeof url_or_options === "string" ? maybe_options : url_or_options) ?? {};
        if (typeof options.clientId !== "string") {
            options.clientId = `fake_${++next_id}`;
        }
        const client = new FakeClient(options);
        connected.push({ url, options, client });
        return client;
    },
}));

//------------------------------------------------------------------------------
const sink: EventSink = { ingest: () => {} };

function config(options: MqttTransportConfig["options"]): MqttTransportConfig {
    return { options, topics: ["a/#"] };
}

//------------------------------------------------------------------------------
describe("MqttTransport", () => {
    beforeEach(() => {
        connected.length = 0;
        next_id = 0;
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    //--------------------------------------------------------------------------
    it("connects with a copy of the config's options, so the generated clientId never lands in the config", async () => {
        const options = { host: "broker", port: 1883 };
        const transport = new MqttTransport(config(options), sink);
        await transport.start();

        expect(connected).toHaveLength(1);
        expect(connected[0].options).not.toBe(options);
        expect(connected[0].options).toMatchObject({ host: "broker", port: 1883 });
        expect(connected[0].options.clientId).toBe("fake_1");
        expect("clientId" in options).toBe(false);
    });

    //--------------------------------------------------------------------------
    it("gives two transports started from the same options object different client ids", async () => {
        const options = { host: "broker", port: 1883 };
        const first = new MqttTransport(config(options), sink);
        const second = new MqttTransport(config(options), sink);
        await first.start();
        await second.start();

        expect(connected.map(entry => entry.options.clientId)).toEqual(["fake_1", "fake_2"]);
    });

    //--------------------------------------------------------------------------
    it("keeps a clientId the config sets", async () => {
        const options = { host: "broker", port: 1883, clientId: "mine" };
        const transport = new MqttTransport(config(options), sink);
        await transport.start();

        expect(connected[0].options.clientId).toBe("mine");
    });

    //--------------------------------------------------------------------------
    it("passes a broker_url through with the options copy", async () => {
        const options = { rejectUnauthorized: false };
        const transport = new MqttTransport({ broker_url: "mqtt://broker:1883", options }, sink);
        await transport.start();

        expect(connected[0].url).toBe("mqtt://broker:1883");
        expect(connected[0].options).not.toBe(options);
        expect(connected[0].options.rejectUnauthorized).toBe(false);
    });

    //--------------------------------------------------------------------------
    it("subscribes to the configured topics on connect", async () => {
        const transport = new MqttTransport(config({ host: "broker" }), sink);
        await transport.start();
        const { client } = connected[0];

        client.emit("connect");

        expect(client.subscriptions).toEqual(["a/#"]);
    });

    //--------------------------------------------------------------------------
    it("warns once about a session takeover after a burst of closes with no error", async () => {
        const transport = new MqttTransport(config({ host: "broker" }), sink);
        await transport.start();
        const { client } = connected[0];
        const warn = vi.mocked(console.warn);

        client.emit("connect");
        client.emit("close");
        client.emit("close");
        expect(warn).not.toHaveBeenCalled();

        client.emit("close");
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("session takeover");
        expect(warn.mock.calls[0][0]).toContain('"fake_1"');

        client.emit("close");
        expect(warn).toHaveBeenCalledTimes(1);
    });

    //--------------------------------------------------------------------------
    it("does not read closes that follow an error as a takeover", async () => {
        const transport = new MqttTransport(config({ host: "broker" }), sink);
        await transport.start();
        const { client } = connected[0];

        for (let i = 0; i < 3; i++) {
            client.emit("error", new Error("boom"));
            client.emit("close");
        }

        expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
    });

    //--------------------------------------------------------------------------
    it("names a session takeover an MQTT 5 broker reports", async () => {
        const transport = new MqttTransport(config({ host: "broker" }), sink);
        await transport.start();
        const { client } = connected[0];

        client.emit("disconnect", { cmd: "disconnect", reasonCode: 0x8e });

        const lines = vi.mocked(console.error).mock.calls.map(call => String(call[0]));
        expect(lines.some(line => line.includes("Session taken over"))).toBe(true);
    });
});
