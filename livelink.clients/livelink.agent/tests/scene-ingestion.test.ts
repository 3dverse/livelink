import { describe, it, expect, vi, beforeEach } from "vitest";

import { SceneIngestion } from "../sources/data/SceneIngestion";
import { IngestionPipeline } from "../sources/data/IngestionPipeline";
import { continuous } from "../sources/data/EventMapping";
import type { EventMapping } from "../sources/data/EventMapping";
import type { EventSink, Transport } from "../sources/data/Transport";

import { FakeAgent, FakeEntity, FakeScene, FakeTransport, makeLivelink, settle } from "./fakes";

//------------------------------------------------------------------------------
// SceneIngestion is the wiring layer: agent lifecycle in, bindings and sources out. The mapping
// behaviour itself is covered by ingestion-pipeline.test.ts, which needs none of this scaffolding.
//------------------------------------------------------------------------------

const SERVO_UUID = "00000000-0000-0000-0000-0000000000e1";

const positionMapping: EventMapping = {
    entities: { byUuid: { "dev-1": SERVO_UUID } },
    updates: source => ({
        id: (source.payload as { id: string }).id,
        update: { local_transform: { position: (source.payload as { pos: [number, number, number] }).pos } },
    }),
};

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

//------------------------------------------------------------------------------
type Harness = {
    agent: FakeAgent;
    transport: FakeTransport;
    onRunning: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>;
    ingestion: SceneIngestion;
};

function setup(mappings: EventMapping | Array<EventMapping>): Harness {
    const agent = new FakeAgent();
    const transport = new FakeTransport();
    const onRunning = vi.fn();
    const onError = vi.fn();

    const ingestion = new SceneIngestion({
        agent: agent.asAgent(),
        pipeline: new IngestionPipeline({ mappings }),
        sources: [
            (sink: EventSink): Transport => {
                transport.sink = sink;
                return transport;
            },
        ],
    });
    ingestion.addEventListener("on-running", onRunning);
    ingestion.addEventListener("on-error", event => onError(event.error));

    return { agent, transport, onRunning, onError, ingestion };
}

//------------------------------------------------------------------------------
describe("SceneIngestion construction", () => {
    it("drives the pipeline the caller built, whose errors stay the caller's", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const agent = new FakeAgent();
        const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline });

        expect(ingestion.pipeline).toBe(pipeline);

        await ingestion.start();
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
        await settle();

        await ingestion.ingest({ channel: "x", payload: { id: "dev-1", pos: [1, 2, 3] } });
        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
    });
});

//------------------------------------------------------------------------------
describe("SceneIngestion lifecycle", () => {
    it("starts the agent on start(); the source starts lazily on the first ready session", async () => {
        const { agent, transport, onRunning, ingestion } = setup(positionMapping);
        await ingestion.start();
        expect(agent.start).toHaveBeenCalledTimes(1);
        expect(transport.start).not.toHaveBeenCalled();

        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", new FakeScene()) });
        await settle();
        expect(transport.start).toHaveBeenCalledTimes(1);
        expect(onRunning).toHaveBeenCalledTimes(1);
        expect(ingestion.boundSessionCount).toBe(1);

        // A second session binds without restarting the source.
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-B", new FakeScene()) });
        await settle();
        expect(transport.start).toHaveBeenCalledTimes(1);
        expect(ingestion.boundSessionCount).toBe(2);
    });

    it("stops the source and the agent on stop()", async () => {
        const { agent, transport, ingestion } = setup(positionMapping);
        await ingestion.start();
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", new FakeScene()) });
        await settle();

        await ingestion.stop();
        expect(transport.stop).toHaveBeenCalledTimes(1);
        expect(agent.stop).toHaveBeenCalledTimes(1);
        expect(ingestion.boundSessionCount).toBe(0);
        expect(ingestion.pipeline.boundSceneCount).toBe(0);
    });

    it("retries the source on the next binding when its start fails", async () => {
        const { agent, transport, onRunning, onError, ingestion } = setup(positionMapping);
        transport.start.mockRejectedValueOnce(new Error("broker down"));
        await ingestion.start();

        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", new FakeScene()) });
        await settle();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "broker down" }));
        expect(onRunning).not.toHaveBeenCalled();

        // A failed start must not leave a dead source behind that blocks every later attempt.
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-B", new FakeScene()) });
        await settle();
        expect(transport.start).toHaveBeenCalledTimes(2);
        expect(onRunning).toHaveBeenCalledTimes(1);
    });

    it("closes a source whose start finished after stop()", async () => {
        const agent = new FakeAgent();
        const transport = new FakeTransport();
        let release = (): void => {};
        const built = new Promise<void>(resolve => {
            release = resolve;
        });

        const ingestion = new SceneIngestion({
            agent: agent.asAgent(),
            pipeline: new IngestionPipeline({ mappings: positionMapping }),
            sources: [
                async (sink: EventSink): Promise<Transport> => {
                    transport.sink = sink;
                    await built;
                    return transport;
                },
            ],
        });

        await ingestion.start();
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", new FakeScene()) });
        await settle();

        // stop() lands while the source is still being built: it has nothing to stop yet.
        await ingestion.stop();
        expect(transport.start).not.toHaveBeenCalled();

        // The in-flight build now completes — it must close what it opened, not leak a live
        // connection (which would keep a Node process alive).
        release();
        await settle();
        await settle();
        expect(transport.stop).toHaveBeenCalledTimes(1);
    });

    it("needs no source at all: events can be pushed straight in", async () => {
        const agent = new FakeAgent();
        const ingestion = new SceneIngestion({
            agent: agent.asAgent(),
            pipeline: new IngestionPipeline({ mappings: positionMapping }),
        });

        await ingestion.start();
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
        await settle();

        await ingestion.ingest({ channel: "webhook", payload: { id: "dev-1", pos: [1, 2, 3] } });

        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
    });

    it("is an EventSink, so a transport can be pointed straight at it", async () => {
        const { agent, transport, ingestion } = setup(positionMapping);
        await ingestion.start();
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
        await settle();

        // The source received the ingestion itself as its sink.
        expect(transport.sink).toBe(ingestion);
        await transport.sink!.ingest({ channel: "mqtt", payload: { id: "dev-1", pos: [1, 2, 3] } });
        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
    });
});

//------------------------------------------------------------------------------
describe("SceneIngestion session binding", () => {
    it("binds a ready session and unbinds it when it leaves", async () => {
        const { agent, ingestion } = setup(positionMapping);
        const bound = vi.fn();
        const unbound = vi.fn();
        ingestion.addEventListener("on-session-bound", bound);
        ingestion.addEventListener("on-session-unbound", unbound);

        await ingestion.start();
        const scene = new FakeScene();
        const livelink = makeLivelink("sess-A", scene);
        agent.emit("on-session-ready", { livelink });
        await settle();
        expect(bound).toHaveBeenCalledTimes(1);
        expect(ingestion.pipeline.boundSceneCount).toBe(1);

        agent.emit("on-session-left", { livelink, reason: "disconnected" });
        expect(unbound).toHaveBeenCalledTimes(1);
        expect(ingestion.boundSessionCount).toBe(0);
        expect(ingestion.pipeline.boundSceneCount).toBe(0);
    });

    it("stops applying to a session after it leaves", async () => {
        const { agent, transport, ingestion } = setup(positionMapping);
        await ingestion.start();
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        const livelink = makeLivelink("sess-A", scene);
        agent.emit("on-session-ready", { livelink });
        await settle();

        agent.emit("on-session-left", { livelink, reason: "disconnected" });
        await transport.sink!.ingest({ channel: "mqtt", payload: { id: "dev-1", pos: [1, 2, 3] } });
        expect(servo.updateComponent).not.toHaveBeenCalled();
    });
});

//------------------------------------------------------------------------------
describe("SceneIngestion continuous-update clock", () => {
    /** A mapping whose update keeps going, so the clock has something to advance. */
    const spinMapping: EventMapping = {
        entities: { byUuid: { "dev-1": SERVO_UUID } },
        updates: () => ({
            id: "dev-1",
            update: continuous(({ since_seconds }) => ({ local_transform: { position: [since_seconds, 0, 0] } })),
        }),
    };

    it("advances continuous updates on its own, with no further events", async () => {
        vi.useFakeTimers();
        try {
            const agent = new FakeAgent();
            const pipeline = new IngestionPipeline({ mappings: spinMapping });
            const ingestion = new SceneIngestion({
                agent: agent.asAgent(),
                pipeline,
                ticksPerSecond: 50,
            });
            await ingestion.start();

            const scene = new FakeScene();
            const servo = new FakeEntity();
            scene.existing.set(SERVO_UUID, servo);
            agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
            await settle();

            await ingestion.ingest({ channel: "mqtt", payload: {} });
            const writes_after_event = servo.updateComponent.mock.calls.length;

            await vi.advanceTimersByTimeAsync(100);
            expect(servo.updateComponent.mock.calls.length).toBeGreaterThan(writes_after_event);
            expect(pipeline.stats?.ticks_processed).toBeGreaterThan(0);

            await ingestion.stop();
            const writes_after_stop = servo.updateComponent.mock.calls.length;
            await vi.advanceTimersByTimeAsync(100);
            expect(servo.updateComponent.mock.calls.length).toBe(writes_after_stop);
        } finally {
            vi.useRealTimers();
        }
    });

    it("stops the clock when the last session leaves, and runs it again on the next one", async () => {
        vi.useFakeTimers();
        try {
            const agent = new FakeAgent();
            const pipeline = new IngestionPipeline({ mappings: spinMapping });
            const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline, ticksPerSecond: 50 });
            await ingestion.start();

            const scene = new FakeScene();
            scene.existing.set(SERVO_UUID, new FakeEntity({ id: SERVO_UUID }));
            const livelink = makeLivelink("sess-A", scene);
            agent.emit("on-session-ready", { livelink });
            await settle();

            await vi.advanceTimersByTimeAsync(100);
            const ticks_while_bound = pipeline.stats!.ticks_processed;
            expect(ticks_while_bound).toBeGreaterThan(0);

            // Nothing is bound any more: a timer still firing into an empty pipeline keeps a Node
            // process from idling and keeps `ticks_processed` climbing over nothing.
            agent.emit("on-session-left", { livelink, reason: "disconnected" });
            await vi.advanceTimersByTimeAsync(200);
            expect(pipeline.stats!.ticks_processed).toBe(ticks_while_bound);

            agent.emit("on-session-ready", { livelink: makeLivelink("sess-B", scene) });
            await settle();
            await vi.advanceTimersByTimeAsync(100);
            expect(pipeline.stats!.ticks_processed).toBeGreaterThan(ticks_while_bound);

            await ingestion.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("stops the motions it was driving when it stops its sources", async () => {
        const agent = new FakeAgent();
        const pipeline = new IngestionPipeline({ mappings: spinMapping });
        const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline, ticksPerSecond: 0 });
        await ingestion.start();

        const scene = new FakeScene();
        scene.existing.set(SERVO_UUID, new FakeEntity({ id: SERVO_UUID }));
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
        await settle();

        await ingestion.ingest({ channel: "mqtt", payload: {} });
        expect(pipeline.stats?.continuations_active).toBe(1);

        // The sources are gone, so no rate is confirmed any more: a later start must not pick the
        // scene back up on one nothing has said since.
        await ingestion.stop();
        expect(pipeline.stats?.continuations_active).toBe(0);
    });

    it("runs no clock at all when `ticksPerSecond` is 0", async () => {
        vi.useFakeTimers();
        try {
            const agent = new FakeAgent();
            const pipeline = new IngestionPipeline({ mappings: spinMapping });
            const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline, ticksPerSecond: 0 });
            await ingestion.start();

            const scene = new FakeScene();
            scene.existing.set(SERVO_UUID, new FakeEntity());
            agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
            await settle();

            await vi.advanceTimersByTimeAsync(200);
            expect(pipeline.stats?.ticks_processed).toBe(0);

            await ingestion.stop();
        } finally {
            vi.useRealTimers();
        }
    });
});

//------------------------------------------------------------------------------
describe("SceneIngestion clock accuracy and safety", () => {
    const spinMapping: EventMapping = {
        entities: { byUuid: { "dev-1": SERVO_UUID } },
        updates: () => ({
            id: "dev-1",
            update: continuous(({ since_seconds }) => ({ local_transform: { position: [since_seconds, 0, 0] } })),
        }),
    };

    /** An ingestion with one bound session whose scene holds the driven entity. */
    async function bound({
        agent = new FakeAgent(),
        ticksPerSecond,
    }: { agent?: FakeAgent; ticksPerSecond?: number } = {}): Promise<{
        pipeline: IngestionPipeline;
        ingestion: SceneIngestion;
    }> {
        const pipeline = new IngestionPipeline({ mappings: spinMapping });
        const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline, ticksPerSecond });
        await ingestion.start();

        const scene = new FakeScene();
        scene.existing.set(SERVO_UUID, new FakeEntity({ id: SERVO_UUID }));
        agent.emit("on-session-ready", { livelink: makeLivelink("sess-A", scene) });
        await settle();

        return { pipeline, ingestion };
    }

    const build = (ticksPerSecond: number): SceneIngestion =>
        new SceneIngestion({
            agent: new FakeAgent().asAgent(),
            pipeline: new IngestionPipeline({ mappings: positionMapping }),
            ticksPerSecond,
        });

    it("rejects a tick rate that would not produce a usable interval", () => {
        // `NaN` is what `Number(process.env.TICKS_PER_SECOND)` yields for any bad value, and
        // `setInterval(fn, NaN)` coerces it to 0 ms — a configuration typo becoming a busy loop.
        expect(() => build(Number.NaN)).toThrow(RangeError);
        expect(() => build(-1)).toThrow(RangeError);
        expect(() => build(1000)).toThrow(/8 ms/);

        // `0` is the one value outside the range that means something: no clock at all.
        expect(() => build(0)).not.toThrow();
    });

    it("defaults its clock to twice the agent's flush rate, not to it", async () => {
        // Two free-running timers at the same rate beat against each other, so the age of a sample
        // at flush time wanders across a whole flush window. Twice as often halves that wander.
        vi.useFakeTimers();
        try {
            const { pipeline, ingestion } = await bound({
                agent: new FakeAgent({ headless_client: { updatesPerSecond: 10 } }),
            });

            await vi.advanceTimersByTimeAsync(1000);
            expect(pipeline.stats?.ticks_processed).toBe(20);

            await ingestion.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("clamps the time one tick may report, so a suspended process does not teleport the scene", async () => {
        vi.useFakeTimers();
        try {
            const now = vi.spyOn(performance, "now").mockReturnValue(0);
            const { pipeline, ingestion } = await bound({ ticksPerSecond: 50 });
            const tick = vi.spyOn(pipeline, "tick");

            // The process comes back from ten minutes of suspension: handing that to a motion at
            // once would put the shaft wherever ten minutes of spinning lands it.
            now.mockReturnValue(600_000);
            await vi.advanceTimersByTimeAsync(20);

            expect(tick).toHaveBeenCalledTimes(1);
            expect(tick).toHaveBeenLastCalledWith(0.5);

            await ingestion.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("never overlaps two ticks, and folds the time a skipped one measured into the next", async () => {
        vi.useFakeTimers();
        try {
            const { pipeline, ingestion } = await bound({ ticksPerSecond: 50 });

            // The first tick hangs on a resolution still in flight — a `spawn` round trip, or a
            // `resolve` reaching a service.
            let release = (): void => {};
            const tick = vi.spyOn(pipeline, "tick").mockImplementationOnce(
                async () =>
                    await new Promise<void>(resolve => {
                        release = resolve;
                    }),
            );

            // Ticks at 20, 40 and 60 ms: only the first may run. Two of them applying at once can
            // write out of order, which also poisons the applier's dedup memory.
            await vi.advanceTimersByTimeAsync(60);
            expect(tick).toHaveBeenCalledTimes(1);
            expect(tick).toHaveBeenNthCalledWith(1, 0.02);

            release();
            await settle();
            await vi.advanceTimersByTimeAsync(20);

            // The 40 ms the two skipped ticks measured is not lost — a motion must not run slow
            // just because the pipeline was busy.
            expect(tick).toHaveBeenCalledTimes(2);
            expect(tick).toHaveBeenNthCalledWith(2, expect.closeTo(0.06, 10));

            await ingestion.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it("advances the motions up to an event before letting it install a new rate", async () => {
        // The slice between the last tick and the event belongs to the rate that was in force
        // during it, not to the one the event is about to install.
        vi.useFakeTimers();
        try {
            const { pipeline, ingestion } = await bound({ ticksPerSecond: 50 });
            const tick = vi.spyOn(pipeline, "tick");

            // Nothing is moving yet, so the first event costs no extra tick at all.
            await ingestion.ingest({ channel: "mqtt", payload: {} });
            expect(tick).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(30); // one tick, at 20 ms
            expect(tick).toHaveBeenCalledTimes(1);

            // 15 ms into the next window, a second event arrives.
            await vi.advanceTimersByTimeAsync(5);
            await ingestion.ingest({ channel: "mqtt", payload: {} });

            expect(tick).toHaveBeenCalledTimes(2);
            expect(tick).toHaveBeenLastCalledWith(expect.closeTo(0.015, 10));

            await ingestion.stop();
        } finally {
            vi.useRealTimers();
        }
    });
});

//------------------------------------------------------------------------------
describe("SceneIngestion events", () => {
    it("re-emits the agent's lifecycle events, so `.agent` is not needed to observe them", async () => {
        const { agent, ingestion } = setup(positionMapping);
        const created = vi.fn();
        const joined = vi.fn();
        const ready = vi.fn();
        const left = vi.fn();
        ingestion.addEventListener("on-session-created", created);
        ingestion.addEventListener("on-session-joined", joined);
        ingestion.addEventListener("on-session-ready", ready);
        ingestion.addEventListener("on-session-left", left);

        await ingestion.start();
        const livelink = makeLivelink("sess-A", new FakeScene());
        agent.emit("on-session-created", { livelink });
        agent.emit("on-session-joined", { livelink });
        agent.emit("on-session-ready", { livelink });
        agent.emit("on-session-left", { livelink, reason: "left-on-condition" });
        await settle();

        expect(created).toHaveBeenCalledTimes(1);
        expect(joined).toHaveBeenCalledTimes(1);
        expect(ready).toHaveBeenCalledTimes(1);
        expect(left).toHaveBeenCalledWith(expect.objectContaining({ livelink, reason: "left-on-condition" }));
    });

    it("forwards agent errors, to the listener and to the onError sugar", async () => {
        const { agent, onError, ingestion } = setup(positionMapping);
        const listener = vi.fn();
        ingestion.addEventListener("on-error", listener);

        await ingestion.start();
        const error = new Error("boom");
        agent.emit("on-error", { error });

        expect(onError).toHaveBeenCalledWith(error);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });

    it("logs an error nobody is listening for, instead of swallowing it", async () => {
        const agent = new FakeAgent();
        const ingestion = new SceneIngestion({
            agent: agent.asAgent(),
            pipeline: new IngestionPipeline({ mappings: positionMapping }),
        });
        await ingestion.start();

        agent.emit("on-error", { error: new Error("unobserved") });

        expect(console.error).toHaveBeenCalledWith(
            "[scene-ingestion]",
            expect.objectContaining({ message: "unobserved" }),
        );
    });
});
