import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { UUID } from "@3dverse/livelink.core";
import { Agent, AgentConfig } from "../sources/Agent";
import type { SessionLeftEvent, AgentErrorEvent } from "../sources/AgentEvents";
import { Livelink } from "../sources/Livelink";
import type { SessionInfo } from "@livelink.base/session/SessionInfo";
import type { ClientInfo } from "@livelink.base/session/ClientInfo";
import type { SessionEvents } from "@livelink.base/session/SessionEvents";
import { Client } from "@livelink.base/session/Client";
import { Session } from "@livelink.base/session/Session";
import { TypedEventTarget } from "@livelink.base/TypedEventTarget";

//------------------------------------------------------------------------------
const SCENE_ID = "00000000-0000-0000-0000-00000000cafe";
const TOKEN = "test-token";
const ROSTER_ID = "00000000-0000-0000-0000-0000000005ad";

//------------------------------------------------------------------------------
function makeClientInfo({ is_headless = false }: { is_headless?: boolean } = {}): ClientInfo {
    return {
        client_id: crypto.randomUUID(),
        client_type: is_headless ? "api" : "user",
        is_headless,
        user_id: crypto.randomUUID(),
        username: "test-user",
    };
}

//------------------------------------------------------------------------------
// A connected other-client, as exposed by `session.other_clients`. Only the
// fields the agent reads (`id`, `is_external`, `client_type`) are modelled;
// clients default to a "user" viewer, matching the default `should_stay`
// fallback which only counts "user" / "guest" clients as company.
function makeClient({
    id = crypto.randomUUID(),
    is_external = false,
    client_type = "user",
}: { id?: UUID; is_external?: boolean; client_type?: ClientInfo["client_type"] } = {}): Client {
    return { id, is_external, client_type } as unknown as Client;
}

//------------------------------------------------------------------------------
function makeSessionInfo({ session_id, clients }: { session_id: UUID; clients?: Array<ClientInfo> }): SessionInfo {
    return { session_id, scene_id: SCENE_ID, is_transient_session: false, clients };
}

//------------------------------------------------------------------------------
// A minimal scene entity: only a name and children, enough for the roster /
// marker-entity logic.
class FakeEntity {
    readonly name: string;
    readonly children: Array<FakeEntity> = [];

    constructor(name: string) {
        this.name = name;
    }

    async getChildren(): Promise<Array<FakeEntity>> {
        return this.children;
    }
}

//------------------------------------------------------------------------------
// A minimal scene exposing just `findEntity` (returns the configured roster) and
// `newEntity` (appends a marker entity to its parent's children).
class FakeScene {
    roster: FakeEntity | null = null;

    findEntity = vi.fn(async (_params: { entity_uuid: UUID }): Promise<FakeEntity | null> => {
        return this.roster;
    });

    newEntity = vi.fn(async ({ name, parent }: { name: string; parent?: FakeEntity | null }): Promise<FakeEntity> => {
        const entity = new FakeEntity(name);
        if (parent) {
            parent.children.push(entity);
        }
        return entity;
    });
}

//------------------------------------------------------------------------------
class FakeSession extends TypedEventTarget<SessionEvents> {
    readonly session_id: UUID;
    readonly has_been_created: boolean;
    readonly client_id: UUID = crypto.randomUUID();
    other_clients: Array<Client> = [];

    constructor({ session_id, created }: { session_id: UUID; created: boolean }) {
        super();
        this.session_id = session_id;
        this.has_been_created = created;
    }

    emitClientJoined(): void {
        this._dispatchEvent(new Event("on-client-joined") as SessionEvents["on-client-joined"]);
    }

    emitClientLeft(): void {
        this._dispatchEvent(new Event("on-client-left") as SessionEvents["on-client-left"]);
    }

    emitDisconnected(): void {
        this._dispatchEvent(new Event("on-disconnected") as SessionEvents["on-disconnected"]);
    }
}

//------------------------------------------------------------------------------
class FakeAgentSession {
    readonly session: FakeSession;
    readonly scene = new FakeScene();
    disconnect_count = 0;
    update_loop_started = false;

    // When set, `startUpdateLoop()` blocks on this promise, letting a test interleave events (e.g.
    // a disconnection) while the session is still being established.
    start_gate: Promise<void> | null = null;

    constructor({ session_id, created }: { session_id: UUID; created: boolean }) {
        this.session = new FakeSession({ session_id, created });
    }

    async startUpdateLoop(): Promise<void> {
        if (this.start_gate !== null) {
            await this.start_gate;
        }
        this.update_loop_started = true;
    }

    async disconnect(): Promise<void> {
        this.disconnect_count += 1;
    }
}

//------------------------------------------------------------------------------
function asLivelink(fake: FakeAgentSession): Livelink {
    return fake as unknown as Livelink;
}

//------------------------------------------------------------------------------
// The spies installed by `installDriverSpies()` on the `Session`/`Livelink` statics, along with
// the per-session bookkeeping shared with the fakes they produce.
type FakeDriver = {
    list: ReturnType<typeof vi.spyOn>;
    start: ReturnType<typeof vi.spyOn>;
    join: ReturnType<typeof vi.spyOn>;
    join_or_start: ReturnType<typeof vi.spyOn>;
    joined_sessions: Map<UUID, FakeAgentSession>;
    rosters: Map<UUID, FakeEntity>;
    start_gates: Map<UUID, Promise<void>>;
};

//------------------------------------------------------------------------------
// Register the roster entity a session's scene should expose once joined. Must be
// called before the agent joins the session (the scene is created on join).
function withRoster(driver: FakeDriver, session_id: UUID, roster: FakeEntity): void {
    driver.rosters.set(session_id, roster);
}

//------------------------------------------------------------------------------
// Block a session's `startUpdateLoop()` until the returned `release` is called, so a test can
// inject an event mid-establish. Must be called before the agent joins the session.
function withStartGate(driver: FakeDriver, session_id: UUID): { release: () => void } {
    let release = (): void => {};
    driver.start_gates.set(
        session_id,
        new Promise<void>(resolve => {
            release = resolve;
        }),
    );
    return { release: () => release() };
}

//------------------------------------------------------------------------------
// Install spies on the `Session`/`Livelink` statics the agent uses, so no test seam is needed in
// the library itself. The statics are restored by the `vi.restoreAllMocks()` in `afterEach`.
function installDriverSpies(): FakeDriver {
    const joined_sessions = new Map<UUID, FakeAgentSession>();
    // Rosters to attach to a session's scene the moment the agent joins it, keyed by session id.
    const rosters = new Map<UUID, FakeEntity>();
    // Gates blocking a session's `startUpdateLoop()` while it is being established, keyed by session id.
    const start_gates = new Map<UUID, Promise<void>>();

    const startFakeSession = async (): Promise<Livelink> => {
        const fake = new FakeAgentSession({ session_id: crypto.randomUUID(), created: true });
        joined_sessions.set(fake.session.session_id, fake);
        return asLivelink(fake);
    };

    const join = vi.spyOn(Livelink, "join").mockImplementation(async ({ session }) => {
        // The agent always joins from a session info, never from a Session instance.
        const { session_info } = session as { session_info: SessionInfo };
        const fake = new FakeAgentSession({ session_id: session_info.session_id, created: false });
        fake.scene.roster = rosters.get(session_info.session_id) ?? null;
        fake.start_gate = start_gates.get(session_info.session_id) ?? null;
        joined_sessions.set(session_info.session_id, fake);
        return asLivelink(fake);
    });

    return {
        list: vi.spyOn(Session, "list").mockImplementation(async () => []),
        start: vi.spyOn(Livelink, "start").mockImplementation(startFakeSession),
        join,
        join_or_start: vi.spyOn(Livelink, "join_or_start").mockImplementation(startFakeSession),
        joined_sessions,
        rosters,
        start_gates,
    };
}

//------------------------------------------------------------------------------
// Records every event the agent dispatches, replacing the old callback mocks.
type EventLog = {
    created: number;
    joined: number;
    ready: number;
    left: Array<SessionLeftEvent>;
    error: Array<AgentErrorEvent>;
};

//------------------------------------------------------------------------------
function recordEvents(agent: Agent): EventLog {
    const log: EventLog = { created: 0, joined: 0, ready: 0, left: [], error: [] };
    agent.addEventListener("on-session-created", () => {
        log.created += 1;
    });
    agent.addEventListener("on-session-joined", () => {
        log.joined += 1;
    });
    agent.addEventListener("on-session-ready", () => {
        log.ready += 1;
    });
    agent.addEventListener("on-session-left", event => {
        log.left.push(event);
    });
    agent.addEventListener("on-error", event => {
        log.error.push(event);
    });
    return log;
}

//------------------------------------------------------------------------------
// Build an agent with the given config (merged onto the scene/token defaults) plus
// its recorded event log. Construction validates the config, so an invalid one
// throws here.
function makeAgent({ config }: { config: Partial<AgentConfig> }): {
    agent: Agent;
    events: EventLog;
} {
    const agent = new Agent({
        config: { scene_id: SCENE_ID, token: TOKEN, ...config },
    });
    return { agent, events: recordEvents(agent) };
}

//------------------------------------------------------------------------------
beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    // Restore the spied Session/Livelink statics: they are shared module state.
    vi.restoreAllMocks();
});

//------------------------------------------------------------------------------
describe("Agent configuration", () => {
    it("rejects the watch option with the 'start' mode", () => {
        installDriverSpies();
        expect(() => makeAgent({ config: { mode: "start", watch: {} } })).toThrow(/watch option/);
    });

    it("rejects the watch option with the 'join-or-start' mode", () => {
        installDriverSpies();
        expect(() => makeAgent({ config: { mode: "join-or-start", watch: {} } })).toThrow(/watch option/);
    });
});

//------------------------------------------------------------------------------
describe("Agent start/stop lifecycle", () => {
    it("rejects a second start while already started", async () => {
        const driver = installDriverSpies();
        const { agent } = makeAgent({ config: { mode: "start" } });

        await agent.start();
        await expect(agent.start()).rejects.toThrow(/already started/);

        // The rejected start attached nothing on top of the first one.
        expect(driver.start).toHaveBeenCalledOnce();
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("stop() before start is a no-op", async () => {
        const driver = installDriverSpies();
        const { agent, events } = makeAgent({ config: { mode: "start" } });

        await agent.stop();

        expect(driver.start).not.toHaveBeenCalled();
        expect(events.left).toHaveLength(0);
    });

    it("a failed start leaves the agent stopped, and restartable", async () => {
        const driver = installDriverSpies();
        driver.join_or_start.mockRejectedValueOnce(new Error("connect failed"));
        const { agent } = makeAgent({ config: {} });

        await expect(agent.start()).rejects.toThrow(/connect failed/);
        expect(agent.livelinks).toHaveLength(0);

        // The failed start cleared the started flag rather than wedging the agent.
        await agent.start();
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("a start whose session setup fails disconnects that session and stays stopped", async () => {
        const driver = installDriverSpies();
        const { agent } = makeAgent({
            config: {
                mode: "start",
                leave_on_condition: {
                    after_seconds: 60,
                    should_stay: () => Promise.reject(new Error("predicate blew up")),
                },
            },
        });

        // 'start' mode establishes inline, so a failing setup rejects start() rather than being
        // swallowed into an on-error the way a watch-loop join would be.
        await expect(agent.start()).rejects.toThrow(/predicate blew up/);

        expect(agent.livelinks).toHaveLength(0);
        const fake = Array.from(driver.joined_sessions.values())[0];
        expect(fake.disconnect_count).toBe(1);

        // No zombie timer left arming behind the failed start.
        await vi.advanceTimersByTimeAsync(120000);
        expect(fake.disconnect_count).toBe(1);
    });

    it("keeps its listeners across a stop/start cycle", async () => {
        installDriverSpies();
        const { agent, events } = makeAgent({ config: { mode: "start" } });

        await agent.start();
        await agent.stop();
        await agent.start();

        // Listeners are attached to the agent itself, so they survive the cycle.
        expect(events.ready).toBe(2);
        expect(events.left).toHaveLength(1);
        await agent.stop();
    });

    it("join() is a no-op while the agent is not started", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({ config: { mode: "manual" } });

        await agent.join({ session_id: "s1" });
        expect(driver.join).not.toHaveBeenCalled();

        await agent.start();
        await agent.join({ session_id: "s1" });
        expect(agent.livelinks).toHaveLength(1);

        await agent.stop();
        await agent.join({ session_id: "s1" });
        expect(agent.livelinks).toHaveLength(0);
    });
});

//------------------------------------------------------------------------------
describe("Agent modes", () => {
    it("'start' creates a new session and reports it as created", async () => {
        const driver = installDriverSpies();
        const { agent, events } = makeAgent({ config: { mode: "start" } });

        await agent.start();

        expect(driver.start).toHaveBeenCalledOnce();
        expect(events.ready).toBe(1);
        expect(events.created).toBe(1);
        expect(events.joined).toBe(0);
        expect(agent.livelinks).toHaveLength(1);
    });

    it("'join' fails fast when no session exists and watch is disabled", async () => {
        installDriverSpies();
        const { agent } = makeAgent({ config: { mode: "join" } });

        await expect(agent.start()).rejects.toThrow(/No session found/);
    });

    it("'join' joins the session picked by the selector and reports it as joined", async () => {
        const driver = installDriverSpies();
        const s1 = makeSessionInfo({ session_id: "s1" });
        const s2 = makeSessionInfo({ session_id: "s2" });
        driver.list.mockResolvedValue([s1, s2]);
        const { agent, events } = makeAgent({
            config: { mode: "join", session_selector: ({ sessions }) => sessions[1] },
        });

        await agent.start();

        expect(driver.join).toHaveBeenCalledOnce();
        const joined = driver.join.mock.calls[0][0].session as { session_info: SessionInfo };
        expect(joined.session_info.session_id).toBe("s2");
        expect(events.joined).toBe(1);
        expect(events.created).toBe(0);
    });

    it("'join-all' joins every existing session", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([
            makeSessionInfo({ session_id: "s1" }),
            makeSessionInfo({ session_id: "s2" }),
            makeSessionInfo({ session_id: "s3" }),
        ]);
        const { agent, events } = makeAgent({ config: { mode: "join-all" } });

        await agent.start();

        expect(events.ready).toBe(3);
        expect(agent.livelinks).toHaveLength(3);
    });

    it("'join-all' survives individual join failures", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" }), makeSessionInfo({ session_id: "s2" })]);
        driver.join.mockRejectedValueOnce(new Error("join failed"));
        const { agent, events } = makeAgent({ config: { mode: "join-all" } });

        await agent.start();

        expect(events.error).toHaveLength(1);
        expect(agent.livelinks).toHaveLength(1);
    });

    it("starts the headless client update loop on every established session", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({ config: { mode: "join-all" } });

        await agent.start();

        expect(driver.joined_sessions.get("s1")?.update_loop_started).toBe(true);
    });
});

//------------------------------------------------------------------------------
describe("Agent watch loop", () => {
    it("'join' with watch idles when no session exists, then joins the first one appearing", async () => {
        const driver = installDriverSpies();
        const { agent } = makeAgent({
            config: { mode: "join", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        expect(agent.livelinks).toHaveLength(0);

        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        await vi.advanceTimersByTimeAsync(5000);

        expect(driver.join).toHaveBeenCalledOnce();
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("'join' with watch does not join a second session while attached to one", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({
            config: { mode: "join", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" }), makeSessionInfo({ session_id: "s2" })]);
        await vi.advanceTimersByTimeAsync(15000);

        expect(driver.join).toHaveBeenCalledOnce();
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("'join-all' with watch joins newcomers and dedups already-joined sessions", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        expect(agent.livelinks).toHaveLength(1);

        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" }), makeSessionInfo({ session_id: "s2" })]);
        await vi.advanceTimersByTimeAsync(5000);

        expect(agent.livelinks).toHaveLength(2);

        await vi.advanceTimersByTimeAsync(10000);
        expect(driver.join).toHaveBeenCalledTimes(2);
        await agent.stop();
    });

    it("survives session list failures and keeps polling", async () => {
        const driver = installDriverSpies();
        const { agent, events } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        driver.list.mockRejectedValueOnce(new Error("api down"));
        await vi.advanceTimersByTimeAsync(5000);

        expect(events.error).toHaveLength(1);

        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        await vi.advanceTimersByTimeAsync(5000);

        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("survives join failures and retries on the next tick", async () => {
        const driver = installDriverSpies();
        const { agent, events } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        driver.join.mockRejectedValueOnce(new Error("join failed"));
        await vi.advanceTimersByTimeAsync(5000);

        expect(events.error).toHaveLength(1);
        expect(agent.livelinks).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(5000);
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });
});

//------------------------------------------------------------------------------
describe("Agent leave-on-condition", () => {
    it("leaves a session after being alone for the configured duration", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: { mode: "join-all", leave_on_condition: { after_seconds: 60 } },
        });

        await agent.start();
        await vi.advanceTimersByTimeAsync(60000);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("left-on-condition");
        expect(driver.joined_sessions.get("s1")?.disconnect_count).toBe(1);
        expect(agent.livelinks).toHaveLength(0);
    });

    it("does not leave while another client is connected (no roster)", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: { mode: "join-all", leave_on_condition: { after_seconds: 60 } },
        });

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        fake.session.other_clients = [makeClient()];
        fake.session.emitClientJoined();

        await vi.advanceTimersByTimeAsync(120000);
        expect(events.left).toHaveLength(0);

        fake.session.other_clients = [];
        fake.session.emitClientLeft();
        await vi.advanceTimersByTimeAsync(60000);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("left-on-condition");
        await agent.stop();
    });

    it("does not count other agent clients as company when an agent_roster is set", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: { after_seconds: 60, agent_roster_id: ROSTER_ID },
            },
        });

        const other_agent = makeClient();
        // The roster already lists the other agent's marker; ours is added on establish.
        const roster = new FakeEntity("roster");
        roster.children.push(new FakeEntity(other_agent.id));
        withRoster(driver, "s1", roster);

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        fake.session.other_clients = [other_agent];
        fake.session.emitClientJoined();

        await vi.advanceTimersByTimeAsync(60000);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("left-on-condition");
    });

    it("leaves when the only other client is another headless agent (no roster)", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: { mode: "join-all", leave_on_condition: { after_seconds: 60 } },
        });

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        // An "api" client is not a viewer: two roster-less agents must not keep
        // each other's session alive forever.
        fake.session.other_clients = [makeClient({ client_type: "api" })];
        fake.session.emitClientJoined();

        await vi.advanceTimersByTimeAsync(60000);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("left-on-condition");
    });

    it("stays while a non-agent client is present when an agent_roster is set", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: { after_seconds: 60, agent_roster_id: ROSTER_ID },
            },
        });

        // The roster only holds our own marker (added on establish); the viewer has none.
        withRoster(driver, "s1", new FakeEntity("roster"));

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        const viewer = makeClient();
        fake.session.other_clients = [viewer];
        fake.session.emitClientJoined();

        await vi.advanceTimersByTimeAsync(120000);
        expect(events.left).toHaveLength(0);
        await agent.stop();
    });

    it("registers a marker entity in the roster on establish", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: { after_seconds: 60, agent_roster_id: ROSTER_ID },
            },
        });

        const roster = new FakeEntity("roster");
        withRoster(driver, "s1", roster);

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;

        expect(fake.scene.newEntity).toHaveBeenCalledTimes(1);
        expect(fake.scene.newEntity).toHaveBeenCalledWith(
            expect.objectContaining({
                name: fake.session.client_id,
                parent: roster,
                options: { delete_on_client_disconnection: true },
            }),
        );
        // The marker named after our client id is now a child of the roster.
        expect(roster.children.map(child => child.name)).toContain(fake.session.client_id);
        await agent.stop();
    });

    it("falls back to other-client presence and logs an error when the roster is missing", async () => {
        const error_spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: { after_seconds: 60, agent_roster_id: ROSTER_ID },
            },
        });

        // No roster entity in the scene: findEntity returns null (the default).
        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        fake.session.other_clients = [makeClient()];
        fake.session.emitClientJoined();

        await vi.advanceTimersByTimeAsync(120000);
        expect(events.left).toHaveLength(0); // stays while any other client is present
        expect(error_spy).toHaveBeenCalled();

        fake.session.other_clients = [];
        fake.session.emitClientLeft();
        await vi.advanceTimersByTimeAsync(60000);
        expect(events.left).toHaveLength(1);

        error_spy.mockRestore();
        await agent.stop();
    });

    it("supports a custom stay predicate", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: {
                    after_seconds: 60,
                    agent_roster_id: ROSTER_ID,
                    should_stay: ({ livelink }) => livelink.session.other_clients.some(c => c.is_external),
                },
            },
        });

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        fake.session.other_clients = [makeClient({ is_external: true })];
        fake.session.emitClientJoined();

        await vi.advanceTimersByTimeAsync(120000);
        expect(events.left).toHaveLength(0);
        await agent.stop();
    });

    it("re-checks the condition before the timer fires and stays if company reappeared", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: { mode: "join-all", leave_on_condition: { after_seconds: 60 } },
        });

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;

        // The agent is alone on establish, so the leave timer is armed. A viewer then reappears, but
        // its client event is lost to a race (no emit here), leaving the timer armed on a stale
        // "alone" snapshot. When it fires it must re-evaluate, see the company and not leave.
        fake.session.other_clients = [makeClient()];
        await vi.advanceTimersByTimeAsync(60000);

        expect(events.left).toHaveLength(0);
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("dispatches on-error when a client-event condition evaluation rejects", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        let evaluations = 0;
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: {
                    after_seconds: 60,
                    // Succeed on the establish evaluation, reject on the client-event one.
                    should_stay: () => {
                        evaluations += 1;
                        return evaluations > 1
                            ? Promise.reject(new Error("roster query failed"))
                            : Promise.resolve(true);
                    },
                },
            },
        });

        await agent.start();
        const fake = driver.joined_sessions.get("s1")!;
        fake.session.emitClientLeft();
        await vi.advanceTimersByTimeAsync(0);

        // The rejection surfaced as an on-error instead of crashing the process, and the session
        // survives the failed evaluation.
        expect(events.error).toHaveLength(1);
        expect(events.error[0].error.message).toMatch(/roster query failed/);
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });

    it("rejoins a session left for being alone only once it has non agent company", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                watch: { interval_seconds: 5 },
                leave_on_condition: { after_seconds: 60 },
            },
        });

        await agent.start();
        await vi.advanceTimersByTimeAsync(60000);
        expect(events.left).toHaveLength(1);

        // The session still exists but with no company: never rejoined.
        await vi.advanceTimersByTimeAsync(30000);
        expect(driver.join).toHaveBeenCalledTimes(1);

        // The session still exists but only lists a headless client: never rejoined.
        driver.list.mockResolvedValue([
            makeSessionInfo({ session_id: "s1", clients: [makeClientInfo({ is_headless: true })] }),
        ]);
        await vi.advanceTimersByTimeAsync(30000);
        expect(driver.join).toHaveBeenCalledTimes(1);

        // A non-headless client shows up: rejoined.
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1", clients: [makeClientInfo()] })]);
        await vi.advanceTimersByTimeAsync(5000);
        expect(driver.join).toHaveBeenCalledTimes(2);
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });
});

//------------------------------------------------------------------------------
describe("Agent disconnection", () => {
    it("dispatches on-session-left with 'disconnected' when the connection drops", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({ config: { mode: "join-all" } });

        await agent.start();
        driver.joined_sessions.get("s1")!.session.emitDisconnected();
        await vi.advanceTimersByTimeAsync(0);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("disconnected");
        expect(agent.livelinks).toHaveLength(0);
    });

    it("does not emit on-session-ready after on-session-left when disconnecting mid-establish", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const gate = withStartGate(driver, "s1");
        const { agent, events } = makeAgent({ config: { mode: "join-all" } });

        // start() blocks inside #establish on the gated livelink.startUpdateLoop().
        const started = agent.start();
        await vi.advanceTimersByTimeAsync(0);

        // The session drops while it is still being established.
        driver.joined_sessions.get("s1")!.session.emitDisconnected();
        await vi.advanceTimersByTimeAsync(0);

        // Let #establish resume; it must observe the record is gone and bail out.
        gate.release();
        await started;
        await vi.advanceTimersByTimeAsync(0);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("disconnected");
        expect(events.ready).toBe(0);
        expect(events.created).toBe(0);
        expect(events.joined).toBe(0);
        expect(agent.livelinks).toHaveLength(0);
    });

    it("tears the session down when the stay predicate rejects during establish", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: {
                mode: "join-all",
                leave_on_condition: {
                    after_seconds: 60,
                    should_stay: () => Promise.reject(new Error("predicate blew up")),
                },
            },
        });

        await agent.start();
        await vi.advanceTimersByTimeAsync(0);

        // The rejecting predicate surfaced as an on-error and the zombie session was cleaned up.
        expect(events.error).toHaveLength(1);
        expect(events.ready).toBe(0);
        expect(agent.livelinks).toHaveLength(0);
        expect(driver.joined_sessions.get("s1")?.disconnect_count).toBe(1);
    });

    it("rejoins freely after a disconnection when watching", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        driver.joined_sessions.get("s1")!.session.emitDisconnected();
        await vi.advanceTimersByTimeAsync(0);
        expect(agent.livelinks).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(5000);

        expect(driver.join).toHaveBeenCalledTimes(2);
        expect(agent.livelinks).toHaveLength(1);
        await agent.stop();
    });
});

//------------------------------------------------------------------------------
describe("Agent stop and manual leave", () => {
    it("stop() leaves all sessions with 'stopped' and halts the watch loop", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" }), makeSessionInfo({ session_id: "s2" })]);
        const { agent, events } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        await agent.stop();

        expect(events.left).toHaveLength(2);
        for (const event of events.left) {
            expect(event.reason).toBe("stopped");
        }
        expect(agent.livelinks).toHaveLength(0);

        const list_calls_after_stop = driver.list.mock.calls.length;
        await vi.advanceTimersByTimeAsync(60000);
        expect(driver.list.mock.calls.length).toBe(list_calls_after_stop);
    });

    it("a manually left session is never rejoined by the watch loop", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        await agent.start();
        await agent.leave({ session_id: "s1" });

        await vi.advanceTimersByTimeAsync(30000);

        expect(driver.join).toHaveBeenCalledTimes(1);
        expect(agent.livelinks).toHaveLength(0);
        await agent.stop();
    });

    it("aborts an in-flight join when leave() targets the session mid-join", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);

        // Hold the join in flight so leave() lands before the session is established.
        let releaseJoin!: () => void;
        const join_gate = new Promise<void>(resolve => {
            releaseJoin = resolve;
        });
        const real_join = driver.join.getMockImplementation()!;
        driver.join.mockImplementationOnce(async (params: { session_id: string }) => {
            await join_gate;
            return real_join(params);
        });

        const { agent, events } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        // start() blocks inside #join on the gated Livelink.join().
        const started = agent.start();
        await vi.advanceTimersByTimeAsync(0);

        // Leave the session while its join is still in flight.
        await agent.leave({ session_id: "s1" });

        // Let the join resolve; #establish must abort instead of staying attached.
        releaseJoin();
        await started;
        await vi.advanceTimersByTimeAsync(0);

        expect(events.ready).toBe(0);
        expect(events.created).toBe(0);
        expect(events.joined).toBe(0);
        expect(agent.livelinks).toHaveLength(0);
        expect(driver.joined_sessions.get("s1")?.disconnect_count).toBe(1);

        // The abort marked the session left with "stopped": the watch loop never rejoins it.
        await vi.advanceTimersByTimeAsync(10000);
        expect(driver.join).toHaveBeenCalledTimes(1);
        await agent.stop();
    });

    it("keeps the leave marker when a join left mid-flight then fails", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);

        // Hold the join in flight, then fail it, so #establish never runs.
        let failJoin!: (error: Error) => void;
        const join_gate = new Promise<void>((_resolve, reject) => {
            failJoin = reject;
        });
        driver.join.mockImplementationOnce(async () => {
            await join_gate;
            throw new Error("unreachable");
        });

        const { agent, events } = makeAgent({
            config: { mode: "join-all", watch: { interval_seconds: 5 } },
        });

        // start() blocks inside #join on the gated Livelink.join().
        const started = agent.start();
        await vi.advanceTimersByTimeAsync(0);

        // Leave the session while its join is still in flight, then fail the join.
        await agent.leave({ session_id: "s1" });
        failJoin(new Error("join failed"));
        await started;
        await vi.advanceTimersByTimeAsync(0);

        expect(events.error).toHaveLength(1);
        expect(agent.livelinks).toHaveLength(0);

        // The failed join must still honour the leave: the watch loop never rejoins s1.
        await vi.advanceTimersByTimeAsync(10000);
        expect(driver.join).toHaveBeenCalledTimes(1);
        await agent.stop();
    });

    it("clears a pending alone timer when leaving", async () => {
        const driver = installDriverSpies();
        driver.list.mockResolvedValue([makeSessionInfo({ session_id: "s1" })]);
        const { agent, events } = makeAgent({
            config: { mode: "join-all", leave_on_condition: { after_seconds: 60 } },
        });

        await agent.start();
        await agent.stop();
        await vi.advanceTimersByTimeAsync(120000);

        expect(events.left).toHaveLength(1);
        expect(events.left[0].reason).toBe("stopped");
    });
});
