import { describe, it, expect, vi, beforeEach } from "vitest";

import { SceneIngestion } from "../sources/data/SceneIngestion";
import { IngestionPipeline } from "../sources/data/IngestionPipeline";
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
        const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline: new IngestionPipeline({ mappings: positionMapping }) });

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
        const ingestion = new SceneIngestion({ agent: agent.asAgent(), pipeline: new IngestionPipeline({ mappings: positionMapping }) });
        await ingestion.start();

        agent.emit("on-error", { error: new Error("unobserved") });

        expect(console.error).toHaveBeenCalledWith("[scene-ingestion]", expect.objectContaining({ message: "unobserved" }));
    });
});
