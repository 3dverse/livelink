import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlaybackTransport } from "../sources/data/transports/PlaybackTransport";
import { defaultTransportRegistry } from "../sources/data/transports/TransportRegistry";
import type { IngestEvent } from "../sources/data/IngestEvent";

//------------------------------------------------------------------------------
let dir: string;

beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    dir = mkdtempSync(join(tmpdir(), "livelink-playback-transport-"));
});

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

//------------------------------------------------------------------------------
/**
 * Collects everything a transport pushes, and lets a test await the first N events. The transport
 * paces messages off their timestamps, so the fixtures below keep them at the same instant.
 */
class CollectingSink {
    events: Array<IngestEvent> = [];
    #waiters: Array<{ count: number; resolve: () => void }> = [];

    ingest = (event: IngestEvent): void => {
        this.events.push(event);
        for (const waiter of this.#waiters.filter(w => this.events.length >= w.count)) {
            waiter.resolve();
        }
        this.#waiters = this.#waiters.filter(w => this.events.length < w.count);
    };

    async waitFor(count: number): Promise<void> {
        if (this.events.length >= count) {
            return;
        }
        await new Promise<void>(resolve => this.#waiters.push({ count, resolve }));
    }
}

//------------------------------------------------------------------------------
function write(name: string, content: string): string {
    const path = join(dir, name);
    writeFileSync(path, content, "utf8");
    return path;
}

//------------------------------------------------------------------------------
const MQTT_DUMP = [
    `uagv/v2/dsautomotion/23070-1100/visualization {"agvPosition":{"x":1}}`,
    `uagv/v2/dsautomotion/23070-1100/state {"actionStates":[]}`,
].join("\n");

//------------------------------------------------------------------------------
describe("PlaybackTransport channel fidelity", () => {
    it("replays an MQTT dump on the RECORDED topics, not a constant", async () => {
        // The whole point of replaying a broker dump: a mapping selecting on `channel` must behave
        // the same live and replayed. Before this, every replayed event arrived on "file".
        const path = write("trace.txt", MQTT_DUMP);

        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: { file_path: path }, loop: false }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events.map(e => e.channel)).toEqual([
            "uagv/v2/dsautomotion/23070-1100/visualization",
            "uagv/v2/dsautomotion/23070-1100/state",
        ]);
        expect(sink.events[0].payload).toEqual({ agvPosition: { x: 1 } });
    });

    it("filters a dump by channel pattern, so the VDA 5050 rule lives with the caller", async () => {
        const path = write(
            "trace.txt",
            [
                `uagv/v2/m/A/order {"a":1}`,
                `uagv/v2/m/A/visualization {"b":2}`,
                `uagv/v2/m/A/state {"c":3}`,
            ].join("\n"),
        );

        const sink = new CollectingSink();
        const transport = new PlaybackTransport(
            { source: { file_path: path }, channel_filter: "uagv/+/+/+/visualization" },
            sink,
        );
        await transport.start();
        await sink.waitFor(1);
        await transport.stop();

        expect(sink.events[0].channel).toBe("uagv/v2/m/A/visualization");
        expect(sink.events[0].payload).toEqual({ b: 2 });
    });

    it("replays channel/payload envelopes, carrying the recorded source timestamp", async () => {
        const path = write(
            "playback.json",
            JSON.stringify([
                { channel: "devices/42", payload: { pos: [1, 2, 3] }, timestamp: "2026-01-01T00:00:00.000Z" },
            ]),
        );

        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: { file_path: path } }, sink);
        await transport.start();
        await sink.waitFor(1);
        await transport.stop();

        expect(sink.events[0].channel).toBe("devices/42");
        expect(sink.events[0].source_timestamp).toEqual(new Date("2026-01-01T00:00:00.000Z"));
        expect(sink.events[0].received_at).toBeInstanceOf(Date);
    });

    it("falls back to a constant channel for a bare-payload recording", async () => {
        const path = write("playback.json", JSON.stringify([{ id: "a", timestamp: "2026-01-01T00:00:00.000Z" }]));

        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: { file_path: path } }, sink);
        await transport.start();
        await sink.waitFor(1);
        await transport.stop();

        expect(sink.events[0].channel).toBe("playback");
        expect(sink.events[0].source_timestamp).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    });

    it("honours a custom default channel", async () => {
        const path = write("playback.json", JSON.stringify([{ id: "a" }]));

        const sink = new CollectingSink();
        const transport = new PlaybackTransport(
            { source: { file_path: path }, default_channel: "saw/telemetry" },
            sink,
        );
        await transport.start();
        await sink.waitFor(1);
        await transport.stop();

        expect(sink.events[0].channel).toBe("saw/telemetry");
    });

    it("warns when the channel filter excludes everything, instead of going quietly silent", async () => {
        const path = write("trace.txt", `uagv/v2/m/A/state {"c":3}`);

        const transport = new PlaybackTransport(
            { source: { file_path: path }, channel_filter: "nothing/#" },
            new CollectingSink(),
        );
        await transport.start();
        await transport.stop();

        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("channel filter"));
    });

    it("rejects a recording that is neither JSON nor a dump", async () => {
        const path = write("garbage.txt", "not json, not a dump");
        const transport = new PlaybackTransport({ source: { file_path: path } }, new CollectingSink());
        await expect(transport.start()).rejects.toThrow(/Failed to parse recording/);
    });
});

//------------------------------------------------------------------------------
describe("PlaybackTransport source forms", () => {
    // A recording is a dump of an event stream; where those bytes come from is the caller's
    // business. Every form below must reach the exact same replay.
    it("replays a dump handed over as a string, with no file system involved", async () => {
        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: MQTT_DUMP }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events[0].channel).toBe("uagv/v2/dsautomotion/23070-1100/visualization");
    });

    it("replays a dump handed over as bytes", async () => {
        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: new TextEncoder().encode(MQTT_DUMP), loop: false }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events.map(e => e.channel)).toHaveLength(2);
    });

    it("replays an ArrayBuffer", async () => {
        const bytes = new TextEncoder().encode(MQTT_DUMP);
        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: bytes.buffer as ArrayBuffer }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events[0].payload).toEqual({ agvPosition: { x: 1 } });
    });

    it("replays records the caller already parsed, skipping JSON entirely", async () => {
        const sink = new CollectingSink();
        const transport = new PlaybackTransport(
            { source: [{ channel: "devices/42", payload: { pos: [1, 2, 3] } }] },
            sink,
        );
        await transport.start();
        await sink.waitFor(1);
        await transport.stop();

        expect(sink.events[0].channel).toBe("devices/42");
        expect(sink.events[0].payload).toEqual({ pos: [1, 2, 3] });
    });

    it("drains a ReadableStream before replaying it", async () => {
        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: new Response(MQTT_DUMP).body!, loop: false }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events.map(e => e.channel)).toEqual([
            "uagv/v2/dsautomotion/23070-1100/visualization",
            "uagv/v2/dsautomotion/23070-1100/state",
        ]);
    });

    it("drains an async iterable of chunks", async () => {
        async function* chunks(): AsyncGenerator<Uint8Array> {
            const encoder = new TextEncoder();
            yield encoder.encode(MQTT_DUMP.slice(0, 20));
            yield encoder.encode(MQTT_DUMP.slice(20));
        }

        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: chunks() }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events[0].channel).toBe("uagv/v2/dsautomotion/23070-1100/visualization");
    });

    it("fetches a URL source", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(MQTT_DUMP, { status: 200 })));

        const sink = new CollectingSink();
        const transport = new PlaybackTransport(
            { source: { url: "https://example.test/dump.txt" }, loop: false },
            sink,
        );
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(fetch).toHaveBeenCalledWith("https://example.test/dump.txt", undefined);
        expect(sink.events).toHaveLength(2);
    });

    it("throws on a failed fetch rather than replaying the error page", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));

        const transport = new PlaybackTransport(
            { source: { url: "https://example.test/missing.json" } },
            new CollectingSink(),
        );
        await expect(transport.start()).rejects.toThrow(/404/);
    });

    it("calls a factory source on start, so it can be built lazily", async () => {
        const factory = vi.fn().mockReturnValue(MQTT_DUMP);

        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source: factory, loop: false }, sink);
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(factory).toHaveBeenCalledTimes(1);
        expect(sink.events).toHaveLength(2);
    });

    it("gives up on a factory that returns itself, instead of hanging", async () => {
        const factory = (): unknown => factory;
        const transport = new PlaybackTransport(
            { source: factory as () => string },
            new CollectingSink(),
        );
        await expect(transport.start()).rejects.toThrow(/returns itself/);
    });

    it("requires a source", () => {
        expect(() => new PlaybackTransport({ source: undefined as unknown as string }, new CollectingSink())).toThrow(
            /source is required/,
        );
    });
});

//------------------------------------------------------------------------------
describe("PlaybackTransport pacing", () => {
    it("replays a one-second gap in a tenth of the time at speed 10", async () => {
        vi.useFakeTimers();
        try {
            const sink = new CollectingSink();
            const transport = new PlaybackTransport(
                {
                    source: [
                        { channel: "a", payload: { n: 1 }, timestamp: "2026-01-01T00:00:00.000Z" },
                        { channel: "a", payload: { n: 2 }, timestamp: "2026-01-01T00:00:01.000Z" },
                    ],
                    speed: 10,
                    loop: false,
                },
                sink,
            );
            await transport.start();

            await vi.advanceTimersByTimeAsync(50);
            expect(sink.events).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(60);
            expect(sink.events).toHaveLength(2);

            await transport.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("replays a dense recording at its recorded rate, not at the timer's", async () => {
        // Messages recorded at the same instant are emitted in one tick. A timer per message would
        // cap this at roughly one message per millisecond — a second for the thousand below.
        const source = Array.from({ length: 1000 }, (_, n) => ({
            channel: "burst",
            payload: { n },
            timestamp: "2026-01-01T00:00:00.000Z",
        }));

        const sink = new CollectingSink();
        const transport = new PlaybackTransport({ source, loop: false }, sink);
        const started_at = Date.now();
        await transport.start();
        await sink.waitFor(1000);
        await transport.stop();

        expect(Date.now() - started_at).toBeLessThan(200);
        expect(sink.events[999].payload).toEqual({ n: 999 });
    });

    it("stops at the end of the recording when looping is off", async () => {
        vi.useFakeTimers();
        try {
            const sink = new CollectingSink();
            const transport = new PlaybackTransport(
                { source: [{ channel: "a", payload: { n: 1 } }], loop: false },
                sink,
            );
            await transport.start();

            await vi.advanceTimersByTimeAsync(1000);
            expect(sink.events).toHaveLength(1);

            await transport.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("loops by default", async () => {
        vi.useFakeTimers();
        try {
            const sink = new CollectingSink();
            const transport = new PlaybackTransport({ source: [{ channel: "a", payload: { n: 1 } }] }, sink);
            await transport.start();

            await vi.advanceTimersByTimeAsync(100);
            expect(sink.events.length).toBeGreaterThan(1);

            await transport.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("rejects a speed that would stall or reverse the replay", () => {
        expect(() => new PlaybackTransport({ source: "x", speed: 0 }, new CollectingSink())).toThrow(/speed/);
        expect(() => new PlaybackTransport({ source: "x", speed: -1 }, new CollectingSink())).toThrow(/speed/);
    });
});

//------------------------------------------------------------------------------
describe("transport registry", () => {
    it("builds a playback transport from a spec", async () => {
        const sink = new CollectingSink();
        const transport = await defaultTransportRegistry.create({
            spec: { kind: "playback", config: { source: MQTT_DUMP } },
            sink,
        });
        await transport.start();
        await sink.waitFor(2);
        await transport.stop();

        expect(sink.events[0].channel).toBe("uagv/v2/dsautomotion/23070-1100/visualization");
    });

    it('still resolves the deprecated "file" kind, default channel included', async () => {
        const path = write("playback.json", JSON.stringify([{ id: "a" }]));

        const sink = new CollectingSink();
        const transport = await defaultTransportRegistry.create({
            spec: { kind: "file", config: { file_path: path } },
            sink,
        });
        await transport.start();
        await sink.waitFor(1);
        await transport.stop();

        expect(sink.events[0].channel).toBe("file");
    });
});
