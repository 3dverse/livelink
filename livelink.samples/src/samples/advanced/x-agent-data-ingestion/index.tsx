//------------------------------------------------------------------------------
// This sample drives a 3dverse scene from a *recorded event stream*, using the
// data-ingestion layer of the `@3dverse/livelink-agent` package.
//
// Nothing here talks to a broker. `telemetry-recording.json` is a dump of what a
// fleet of four devices published over 8 seconds, each at 60 Hz — the exact
// shape you would capture off MQTT — and `PlaybackTransport` replays it at the
// recorded pace, ~240 events a second.
// The dump is handed over as a **string** (`import ... ?raw`), which is why this
// runs in the browser: the transport reads a *source*, and a file path is only
// one of the forms it accepts.
//
// For the same pipeline fed by live infrastructure instead, see the MQTT and
// OPC UA samples under `livelink.clients/livelink.agent/samples/` — headless
// Node.js agents rather than pages, run against a broker or a PLC you start
// yourself with one docker command.
//
// The page is split in three:
//
//   • <Viewer/>         — a regular livelink-react viewport, so you can watch
//                         what the ingestion does to the scene.
//   • <DataIngestion/>  — runs the ingestion. It does no rendering at all: it
//                         only maps events onto entities, exactly like a
//                         server-side process would.
//   • the overlay panels — stacked on the left, both collapsible: the recording
//                         with a cursor on the event being replayed, and under it
//                         the live event trace. The pipeline counters sit with
//                         the controls at the bottom.
//
// IMPORTANT: everything under the "Ingestion" banner is plain TypeScript with
// **no React or DOM dependency**. The very same code can run in any JS runtime —
// most notably as a Node.js script, where `source` would be
// `{ file_path: "./telemetry-recording.json" }` instead.
//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    Agent,
    IngestionPipeline,
    PlaybackTransport,
    SceneIngestion,
} from "@3dverse/livelink-agent";
import type {
    AgentConfig,
    ComponentsManifest,
    EventMapping,
    EventSink,
    IngestEvent,
    IngestionStats,
    Quat,
    SessionInfo as AgentSessionInfo,
    UUID,
    Vec3,
} from "@3dverse/livelink-agent";

import {
    Livelink as LivelinkComponent,
    Canvas,
    Viewport,
    LivelinkContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";
import { ButtonGroupSelect } from "@/components/common/ButtonGroupSelect";
import {
    EventTracePanel,
    IngestionStatsBar,
    SourceTextPanel,
    useEventTrace,
} from "@/components/common/ingestion";

//------------------------------------------------------------------------------
// The recorded event stream, imported as raw text: this exact string is what the
// transport replays, and what the left panel displays.
import RECORDING_TEXT from "./telemetry-recording.json?raw";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = "1ba0218c-a0d9-4b26-9b80-2413a75d79c4";

// The scene and assets are the same ones used by the "Headless Agent" sample.
const MESH_REF = "0577814f-4677-420b-89e8-1e5a4dd56914";
const MATERIAL_REF = {
    light: "5bd5d2c5-65d3-4cdb-adb1-c85ae1502840",
    green: "afbcef75-7c52-4a90-b6e6-d19dcc04c3ad",
    dark: "c9650d73-0f0b-4064-843f-ff0bb8d506e7",
    orange: "78b48c3a-9988-433a-9237-9ea5dc7a57e5",
} as const;
// The recorded `state` values, and the material each one paints the device with.
const MATERIAL_BY_STATE: Record<string, string> = {
    running: MATERIAL_REF.green,
    charging: MATERIAL_REF.orange,
    idle: MATERIAL_REF.dark,
};

type SessionInfo = {
    session_id: UUID;
    token: string;
};

//------------------------------------------------------------------------------
export function App() {
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

    return (
        <>
            <Viewer setSessionInfo={setSessionInfo} />
            <DataIngestion sessionInfo={sessionInfo} />
        </>
    );
}

//==============================================================================
// Viewer: a plain livelink-react viewport so we can see the scene the ingestion
// drives. It creates a transient session that the agent then joins.
//==============================================================================
function Viewer({
    setSessionInfo,
}: {
    setSessionInfo: (sessionInfo: SessionInfo | null) => void;
}) {
    return (
        <LivelinkComponent
            sceneId={SCENE_ID}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
            isTransient={true}
        >
            <SessionSniffer setSessionInfo={setSessionInfo} />
            <AppLayout />
        </LivelinkComponent>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function SessionSniffer({
    setSessionInfo,
}: {
    setSessionInfo: (sessionInfo: SessionInfo | null) => void;
}) {
    const { instance } = useContext(LivelinkContext);
    useEffect(() => {
        setSessionInfo(
            instance
                ? {
                      session_id: instance.session.session_id,
                      token: instance.session.token,
                  }
                : null,
        );
        return () => setSessionInfo(null);
    }, [instance, setSessionInfo]);
    return null;
}

//==============================================================================
// Ingestion: this whole section is runtime-agnostic. It only depends on
// `@3dverse/livelink-agent` and could be lifted verbatim into a Node.js script.
//==============================================================================

//------------------------------------------------------------------------------
// The `index`-th `/`-separated segment of a channel, or null when the channel has no such segment.
// A negative index counts back from the end, `-1` being the last segment.
//------------------------------------------------------------------------------
function channelSegment(channel: string, index: number): string | null {
    const segments = channel.split("/");
    return segments[index < 0 ? segments.length + index : index] ?? null;
}

//------------------------------------------------------------------------------
// A quaternion for a rotation of `yaw` radians about the Y (up) axis.
//------------------------------------------------------------------------------
function yawQuaternion(yaw: number): Quat {
    return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

//------------------------------------------------------------------------------
// The device id is the middle segment of the recorded channel — the same routing
// key the broker used, preserved by the playback.
//------------------------------------------------------------------------------
function deviceId(channel: string): string | null {
    return channelSegment(channel, 1);
}

//------------------------------------------------------------------------------
// One mapping per event type. `devices/+/telemetry` spawns a device on its first
// frame and moves it on every one after that; `devices/+/status` repaints the
// device that is already there.
//------------------------------------------------------------------------------
const TELEMETRY_MAPPING: EventMapping = {
    channel: "devices/+/telemetry",

    // Validated on the first event by default, so a recording that does not carry
    // what the mapping reads is reported instead of silently doing nothing.
    schema: {
        type: "object",
        properties: {
            pos: {
                type: "array",
                items: { type: "number" },
                minItems: 3,
                maxItems: 3,
            },
            yaw: { type: "number" },
        },
        required: ["pos"],
    },

    // The stream defines the population: one entity per device id, created the
    // first time that id is seen, deleted when the agent disconnects.
    entities: {
        spawn: {
            name: ({ id }) => `device-${id}`,
            components: ({ id, event }): ComponentsManifest => ({
                debug_name: { value: `device-${id}` },
                local_transform: {
                    position: (event.payload as { pos: Vec3 }).pos,
                    scale: [0.6, 0.6, 0.6],
                },
                mesh_ref: { value: MESH_REF },
                material_ref: { value: MATERIAL_REF.light },
            }),
            options: { delete_on_client_disconnection: true },
        },
    },

    updates: event => {
        const id = deviceId(event.channel);
        if (id === null) {
            return null;
        }
        const { pos, yaw } = event.payload as { pos: Vec3; yaw?: number };
        return {
            id,
            update: {
                local_transform: {
                    position: pos,
                    ...(yaw !== undefined
                        ? { orientation: yawQuaternion(yaw) }
                        : {}),
                },
            },
        };
    },
};

//------------------------------------------------------------------------------
const STATUS_MAPPING: EventMapping = {
    channel: "devices/+/status",

    // This one addresses entities that already exist, by the name the mapping
    // above spawned them under. A status arriving before its device has been
    // created resolves to nothing — and resolves again on its own as soon as the
    // entity appears (watch `unresolved_entity` in the counters below).
    entities: {
        byName: ({ id }) => `device-${id}`,
    },

    updates: event => {
        const id = deviceId(event.channel);
        const material_ref =
            MATERIAL_BY_STATE[(event.payload as { state: string }).state];
        if (id === null || material_ref === undefined) {
            return null;
        }
        return { id, update: { material_ref: { value: material_ref } } };
    },
};

//------------------------------------------------------------------------------
// An `EventSink` that reports every event before passing it on. `SceneIngestion` *is* the real
// sink, so wrapping it is all it takes to watch the stream go by — no SDK hook needed.
//------------------------------------------------------------------------------
function observedSink({ sink, onEvent }: { sink: EventSink; onEvent: (event: IngestEvent) => void }): EventSink {
    return {
        ingest(event: IngestEvent): void | Promise<void> {
            onEvent(event);
            return sink.ingest(event);
        },
    };
}

//------------------------------------------------------------------------------
// Build the ingestion: an agent to attach to the session, a pipeline holding the
// two mappings, and the recording as its single source.
//------------------------------------------------------------------------------
function createIngestion({
    config,
    speed,
    onEvent,
    onError,
}: {
    config: AgentConfig;
    speed: number;
    onEvent: (event: IngestEvent) => void;
    onError: (error: Error) => void;
}): SceneIngestion {
    const ingestion = new SceneIngestion({
        agent: new Agent({ config }),
        pipeline: new IngestionPipeline({
            mappings: [TELEMETRY_MAPPING, STATUS_MAPPING],
            onError,
        }),

        // A source can be a `TransportSpec` — `{ kind: "playback", config: { source } }` — or, as
        // here, a factory receiving the sink to push into. The factory form is what lets us slip
        // the observing sink in between. The transport is still owned by the ingestion: started on
        // the first ready session, stopped with it.
        sources: [
            sink =>
                new PlaybackTransport(
                    {
                        // In Node this would read `{ file_path: "./telemetry-recording.json" }`, or
                        // `{ url }`, or a stream — the replay is identical.
                        source: RECORDING_TEXT,
                        speed,
                        loop: true,
                    },
                    observedSink({ sink, onEvent }),
                ),
        ],
    });

    ingestion.addEventListener("on-error", ({ error }) => onError(error));

    return ingestion;
}

//==============================================================================
// DataIngestion: a thin React wrapper that starts/stops the runtime-agnostic
// ingestion above and renders what it is doing.
//==============================================================================

// The recording holds one event per line, so the event index *is* its line index
// (line 0 being the opening bracket).
const RECORDING_EVENT_COUNT = RECORDING_TEXT.split("\n").filter(line =>
    line.trimStart().startsWith("{"),
).length;

const SPEEDS = [
    { value: 0.5, label: "0.5×" },
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 5, label: "5×" },
];

//------------------------------------------------------------------------------
function DataIngestion({ sessionInfo }: { sessionInfo: SessionInfo | null }) {
    const [isStarted, setIsStarted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [stats, setStats] = useState<IngestionStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Events arrive ~240 times a second: the trace buffers them and publishes on
    // a timer rather than setting state per event.
    const { rows, count, onEvent, reset } = useEventTrace({
        describe: describePayload,
    });

    const startIngestion = useCallback(async () => {
        if (!sessionInfo) {
            throw new Error("Session info is not available");
        }

        // Default mode is "join-or-start". The session selector pins the agent to
        // the exact transient session the viewer created, so the entities the
        // ingestion drives show up live in the viewport behind these panels.
        const config: AgentConfig = {
            scene_id: SCENE_ID,
            token: sessionInfo.token,
            is_transient: true,
            session_selector: ({
                sessions,
            }: {
                sessions: Array<AgentSessionInfo>;
            }) =>
                sessions.find(s => s.session_id === sessionInfo.session_id) ??
                null,

            // The one tuning an ingestion agent actually needs. The client does
            // not send an entity the moment you write it: it flushes whatever is
            // dirty on a fixed timer, 30 times a second by default. Leave that at
            // 30 while the stream also arrives at 30 Hz and the two free-running
            // timers alias — some flushes carry two samples (the first is
            // overwritten in the dirty entity and never sent), some carry none,
            // and the motion judders even though every position was ingested.
            // Keep the flush rate comfortably above the data rate and each sample
            // gets its own flush. Rates are capped at 125 (an 8 ms interval).
            headless_client: { updatesPerSecond: 120 },
        };

        const ingestion = createIngestion({
            config,
            speed,
            onEvent,
            onError: reported => setError(reported.message),
        });
        await ingestion.start();

        return ingestion;
    }, [sessionInfo, speed, onEvent]);

    // Restarts on a speed change: the transport paces off the recorded timestamps
    // when it starts, so a new speed means a new replay.
    useEffect(() => {
        if (!isStarted || !sessionInfo) {
            return;
        }

        let ingestion: SceneIngestion | null = null;
        let isUnmounted = false;

        setError(null);
        reset();

        startIngestion().then(
            started => {
                if (isUnmounted) {
                    void started.stop();
                    return;
                }
                ingestion = started;
            },
            failure =>
                setError(
                    failure instanceof Error
                        ? failure.message
                        : String(failure),
                ),
        );

        const poll = setInterval(() => setStats(ingestion?.stats ?? null), 100);

        return () => {
            isUnmounted = true;
            clearInterval(poll);
            void ingestion?.stop();
        };
    }, [isStarted, sessionInfo, startIngestion, reset]);

    if (!sessionInfo) {
        return (
            <p className="absolute bottom-[5vh] w-full text-center">
                Start by creating a session
            </p>
        );
    }

    return (
        <>
            {/* Both panels stacked in one column, so the rest of the viewport stays clear. */}
            <div className="absolute top-4 left-4 z-50 w-[26rem] max-w-[40vw] flex flex-col gap-2">
                <SourceTextPanel
                    title="telemetry-recording.json"
                    text={RECORDING_TEXT}
                    activeLine={
                        isStarted && count > 0
                            ? ((count - 1) % RECORDING_EVENT_COUNT) + 1
                            : null
                    }
                />
                <EventTracePanel rows={rows} />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
                {error && (
                    <p className="px-3 py-1 bg-[black] text-[#ff6363] text-xs rounded-sm">
                        {error}
                    </p>
                )}
                <IngestionStatsBar stats={stats} />
                <div className="flex items-center gap-3">
                    <button
                        className="button button-primary"
                        onClick={() => setIsStarted(prev => !prev)}
                    >
                        {isStarted ? "Stop" : "Start"} ingestion
                    </button>
                    <div className="flex items-center gap-1 text-xs">
                        <ButtonGroupSelect
                            value={speed}
                            items={SPEEDS}
                            onChange={setSpeed}
                            buttonClassName="px-2 py-1 rounded-sm min-w-10 text-center cursor-pointer text-xs"
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

//------------------------------------------------------------------------------
function describePayload(payload: unknown): string {
    if (payload === null || typeof payload !== "object") {
        return String(payload);
    }
    const { pos, state } = payload as { pos?: Vec3; state?: string };
    if (pos) {
        return `pos [${pos.map(n => n.toFixed(2)).join(", ")}]`;
    }
    if (state) {
        return `state ${state}`;
    }
    return JSON.stringify(payload);
}
