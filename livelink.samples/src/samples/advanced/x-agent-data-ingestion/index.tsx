//------------------------------------------------------------------------------
// This sample drives a 3dverse scene from recorded event data (like MQTT streams).
// It has three main parts:
//   • <Viewer/> — shows the 3D scene with vehicle telemetry overlays
//   • <DataIngestion/> — processes the event stream and updates entities
//   • Overlay panels — display the recording, event trace, and statistics
//
// Data includes: vehicles (forklifts/drones) as sub-scene instances, and a
// stationary robotic arm with its pre-existing pivots.
//
// The "Ingestion" section is runtime-agnostic: plain TypeScript with no React.
// The same code runs in Node.js, browser, or anywhere JavaScript runs.
//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useRef, useState } from "react";

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
    Entity as AgentEntity,
    EventMapping,
    EventSink,
    IngestEvent,
    IngestionStats,
    Quat,
    Scene as AgentScene,
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
    useEntities,
    CameraController,
    DOM3DOverlay,
    DOM3DEntityAnchor,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";
import {
    EventTracePanel,
    IngestionStatsPanel,
    SourceTextPanel,
    SpeedSelect,
    useEventTrace,
} from "./components";

//------------------------------------------------------------------------------
// Pre-recorded event stream (replayed by the transport).
import RECORDING_TEXT from "./x-agent-data-ingestion-recording.json?raw";
import { CameraControllerPresets } from "@3dverse/livelink";
import type { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = "1ba0218c-a0d9-4b26-9b80-2413a75d79c4";
const FORKLIFT_SCENE_ID = "9d98d81a-f650-433d-9663-e85b4c38208e";
const DRONE_SCENE_ID = "dac0881d-7fb9-476e-8953-b75abcf66cf8";

type SessionInfo = {
    session_id: UUID;
    token: string;
};

//------------------------------------------------------------------------------
export function App() {
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

    // Shared state for telemetry label visibility (saves bandwidth when off).
    const [areLabelsVisible, setAreLabelsVisible] = useState(true);

    return (
        <>
            <Viewer
                setSessionInfo={setSessionInfo}
                areLabelsVisible={areLabelsVisible}
            />
            <DataIngestion
                sessionInfo={sessionInfo}
                areLabelsVisible={areLabelsVisible}
                setAreLabelsVisible={setAreLabelsVisible}
            />
        </>
    );
}

//==============================================================================
// Viewer: a plain livelink-react viewport so we can see the scene the ingestion
// drives. It creates a transient session that the agent then joins.
//==============================================================================
function Viewer({
    setSessionInfo,
    areLabelsVisible,
}: {
    setSessionInfo: (sessionInfo: SessionInfo | null) => void;
    areLabelsVisible: boolean;
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
            <AppLayout areLabelsVisible={areLabelsVisible} />
        </LivelinkComponent>
    );
}

//------------------------------------------------------------------------------
function AppLayout({ areLabelsVisible }: { areLabelsVisible: boolean }) {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController
                    preset={CameraControllerPresets.pointer_locked_orbital}
                />
                <DOM3DOverlay>
                    {areLabelsVisible && <VehicleLabels />}
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
// Parse key=value tags into a record.
function parseTags(tags: Array<string>): Record<string, string> {
    return Object.fromEntries(
        tags.map(tag => {
            const separator = tag.indexOf("=");
            return separator === -1
                ? [tag, ""]
                : [tag.slice(0, separator), tag.slice(separator + 1)];
        }),
    );
}

//------------------------------------------------------------------------------
// Render telemetry labels for all vehicles (entities with "tags" component).
//------------------------------------------------------------------------------
function VehicleLabels() {
    // Re-render when tags change; transform updates tracked by anchor.
    const { entities } = useEntities({ mandatory_components: ["tags"] }, [
        "tags",
    ]);

    return entities.map(entity => (
        <VehicleLabel key={entity.id} entity={entity} />
    ));
}

//------------------------------------------------------------------------------
// Render one vehicle's telemetry label (anchored at center-bottom of entity).
function VehicleLabel({ entity }: { entity: Entity }) {
    const telemetry = parseTags(entity.tags?.value ?? []);

    // Skip if not a vehicle.
    if (!telemetry.kind) {
        return null;
    }

    // Format speed to one decimal place (e.g., "3.2 m/s").
    const speed = `${Number(telemetry.speed).toFixed(1)} m/s`;

    const readings: Array<{ label: string; value: string; color?: string }> =
        telemetry.kind === "drone"
            ? [
                  { label: "alt", value: `${telemetry.alt} m` },
                  { label: "speed", value: speed },
                  {
                      label: "link",
                      value: `${telemetry.link} %`,
                      color: gaugeColor(Number(telemetry.link), {
                          mid: 50,
                          low: 30,
                      }),
                  },
              ]
            : [
                  { label: "speed", value: speed },
                  { label: "load", value: `${telemetry.load} kg` },
                  { label: "mast", value: `${telemetry.mast} m` },
              ];

    return (
        <DOM3DEntityAnchor entity={entity} offset="center-bottom">
            <div className="pointer-events-none select-none">
                <div className="w-64 px-3 py-2 rounded-lg bg-[#0b1421]/85 border border-[#1f3350] font-mono text-white">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base">{telemetry.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#1f3350] text-[#addb67]">
                            {telemetry.state}
                        </span>
                    </div>

                    <div className="mt-1 flex gap-3 text-sm tabular-nums">
                        {readings.map(({ label, value, color }) => (
                            <div key={label}>
                                <div className="text-[#63ffff]">{label}</div>
                                {/* Fixed width to prevent layout shift. */}
                                <div
                                    className="w-[7ch]"
                                    style={color ? { color } : undefined}
                                >
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <BatteryGauge percent={Number(telemetry.battery)} />
                </div>
            </div>
        </DOM3DEntityAnchor>
    );
}

//------------------------------------------------------------------------------
// Green above `mid`, orange down to `low`, red below — the coloring a gauge
// value (battery, radio link, ...) gets once it starts running low.
//------------------------------------------------------------------------------
function gaugeColor(
    percent: number,
    { mid, low }: { mid: number; low: number } = { mid: 60, low: 30 },
): string {
    return percent > mid ? "#addb67" : percent > low ? "#ffcb6b" : "#ff6363";
}

//------------------------------------------------------------------------------
function BatteryGauge({ percent }: { percent: number }) {
    const level = Math.max(0, Math.min(100, percent));
    const color = gaugeColor(level);

    return (
        <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#1f3350] overflow-hidden">
                <div
                    className="h-full rounded-full"
                    style={{ width: `${level}%`, background: color }}
                />
            </div>
            <span className="text-xs tabular-nums" style={{ color }}>
                {level.toFixed(0)}%
            </span>
        </div>
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
// Get the index-th "/" -separated segment from a channel string (negative counts from end).
function channelSegment(channel: string, index: number): string | null {
    const segments = channel.split("/");
    return segments[index < 0 ? segments.length + index : index] ?? null;
}

//------------------------------------------------------------------------------
// Convert yaw/pitch/roll angles to a quaternion.
function orientationQuaternion({
    yaw,
    pitch = 0,
    roll = 0,
}: {
    yaw: number;
    pitch?: number;
    roll?: number;
}): Quat {
    const [cy, sy] = [Math.cos(yaw / 2), Math.sin(yaw / 2)];
    const [cp, sp] = [Math.cos(pitch / 2), Math.sin(pitch / 2)];
    const [cr, sr] = [Math.cos(roll / 2), Math.sin(roll / 2)];

    return [
        cy * sp * cr + sy * cp * sr,
        sy * cp * cr - cy * sp * sr,
        cy * cp * sr - sy * sp * cr,
        cy * cp * cr + sy * sp * sr,
    ];
}

//------------------------------------------------------------------------------
// Extract device ID from the channel's middle segment.
function deviceId(channel: string): string | null {
    return channelSegment(channel, 1);
}

//------------------------------------------------------------------------------
// Vehicle stream: spawn on first event, move on subsequent events.
// Telemetry (speed, battery, etc.) goes on a companion entity (see
// VEHICLE_BROADCAST_MAPPING below) to optimize network broadcasts.
//------------------------------------------------------------------------------
type VehicleTelemetry = {
    pos: Vec3;
    yaw: number;
    pitch?: number;
    roll?: number;
    speed: number;
    battery: number;
    state: string;
    load?: number;
    mast?: number;
    alt?: number;
    link?: number;
};

// The kind is carried by the id: `forklift-01` is a forklift, `drone-02` a drone.
function vehicleKind(id: string): string {
    return id.startsWith("drone") ? "drone" : "forklift";
}

function vehicleSceneRef(id: string): UUID {
    return vehicleKind(id) === "drone" ? DRONE_SCENE_ID : FORKLIFT_SCENE_ID;
}

function vehicleScale(id: string): number {
    return vehicleKind(id) === "drone" ? 5 : 1;
}

//------------------------------------------------------------------------------
// Telemetry stored as key=value tags (e.g., "speed=5.2", "battery=87").
//------------------------------------------------------------------------------
const TAGGED_FIELDS = [
    "speed",
    "battery",
    "state",
    "load",
    "mast",
    "alt",
    "link",
] as const satisfies ReadonlyArray<keyof VehicleTelemetry>;

function vehicleTags(id: string, telemetry: VehicleTelemetry): Array<string> {
    // The id is in here because the entity carrying these tags is *not* the
    // vehicle — its own name is the companion's, and how that name is built is
    // nobody else's business. The position is not: that is the entity's transform.
    const tags = [`id=${id}`, `kind=${vehicleKind(id)}`];
    for (const field of TAGGED_FIELDS) {
        const value = telemetry[field];
        if (value !== undefined) {
            tags.push(`${field}=${value}`);
        }
    }
    return tags;
}

//------------------------------------------------------------------------------
// Update telemetry tags 4x per second (250ms) to reduce network traffic.
const TAG_REFRESH_MS = 250;
const last_tag_refresh = new Map<string, number>();

function shouldRefreshTags(id: string, event: IngestEvent): boolean {
    const at = event.received_at ?? event.source_timestamp;
    const bucket = Math.floor((at?.getTime() ?? Date.now()) / TAG_REFRESH_MS);
    if (last_tag_refresh.get(id) === bucket) {
        return false;
    }
    last_tag_refresh.set(id, bucket);
    return true;
}

const VEHICLE_CHANNEL_PREFIX = "vehicles/";

const VEHICLE_MAPPING: EventMapping = {
    channel: `${VEHICLE_CHANNEL_PREFIX}+/telemetry`,

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
            pitch: { type: "number" },
            roll: { type: "number" },
            speed: { type: "number" },
            battery: { type: "number" },
            state: { type: "string" },
            load: { type: "number" },
            mast: { type: "number" },
            alt: { type: "number" },
            link: { type: "number" },
        },
        required: ["pos", "yaw", "speed", "battery", "state"],
    },

    entities: {
        spawn: {
            name: ({ id }) => id,
            components: ({ id, event }): ComponentsManifest => {
                const scale = vehicleScale(id);
                const telemetry = event.payload as VehicleTelemetry;
                return {
                    debug_name: { value: id },
                    local_transform: {
                        position: telemetry.pos,
                        orientation: orientationQuaternion(telemetry),
                        scale: [scale, scale, scale],
                    },
                    scene_ref: { value: vehicleSceneRef(id) },
                };
            },
            options: { delete_on_client_disconnection: true },
        },
    },

    updates: event => {
        const id = deviceId(event.channel);
        if (id === null) {
            return null;
        }
        const telemetry = event.payload as VehicleTelemetry;
        return {
            id,
            update: {
                local_transform: {
                    position: telemetry.pos,
                    orientation: orientationQuaternion(telemetry),
                },
            },
        };
    },
};

//------------------------------------------------------------------------------
// Broadcast entity: carries telemetry for the DOM overlay to read.
// Separate from the main vehicle entity to optimize network updates.
//------------------------------------------------------------------------------

// Height above vehicle where label floats.
const LABEL_HEIGHT_M: Record<string, number> = { forklift: 2.7, drone: 3 };

function labelPosition(id: string, telemetry: VehicleTelemetry): Vec3 {
    const [x, y, z] = telemetry.pos;
    return [x, y + (LABEL_HEIGHT_M[vehicleKind(id)] ?? 1), z];
}

function broadcastEntityName(id: string): string {
    return `broadcast_data-${id}`;
}

const VEHICLE_BROADCAST_MAPPING: EventMapping = {
    channel: `${VEHICLE_CHANNEL_PREFIX}+/telemetry`,

    // Reuse validated events from VEHICLE_MAPPING.
    entities: {
        spawn: {
            name: ({ id }) => broadcastEntityName(id),
            components: ({ id, event }): ComponentsManifest => {
                const telemetry = event.payload as VehicleTelemetry;
                return {
                    debug_name: { value: broadcastEntityName(id) },
                    local_transform: {
                        position: labelPosition(id, telemetry),
                    },
                    // Tags included at creation (not updated later).
                    tags: { value: vehicleTags(id, telemetry) },
                };
            },
            options: { delete_on_client_disconnection: true },
        },
    },

    updates: event => {
        const id = deviceId(event.channel);
        if (id === null) {
            return null;
        }
        const telemetry = event.payload as VehicleTelemetry;
        return {
            id,
            update: {
                local_transform: { position: labelPosition(id, telemetry) },
                ...(shouldRefreshTags(id, event)
                    ? { tags: { value: vehicleTags(id, telemetry) } }
                    : {}),
            },
        };
    },
};

//------------------------------------------------------------------------------
// Robotic arm: four pivots already in the scene.
// Uses byUuid mapping to resolve entities by UUID instead of spawning them.
// Fill in the pivot UUIDs with your own scene's values.
//------------------------------------------------------------------------------
type ArmJointTelemetry = { axis: number; angle: number };

const ARM_CHANNEL = "arms/fanuc-01/joint";

// The chain of scene references the pivots sit under.
const ARM_LINKAGE: Array<UUID> = [
    "d3922580-54a0-49cc-bb86-145cbf823e24" as UUID,
];

// Each pivot's own local rotation axis: the base swings about Y (up), the rest
// hinge about Z.
const PIVOT_ROTATION_AXIS: Record<string, Vec3> = {
    "0": [0, 1, 0],
    "1": [1, 0, 0],
    "2": [1, 0, 0],
    "3": [1, 0, 0],
};

// Fill these in with the four pivot entities from your own copy of the scene.
const PIVOT_ENTITIES: Record<string, UUID> = {
    "0": "9706fe3e-1191-49ad-a09e-060335f74e49" as UUID,
    "1": "adb826d9-4ad3-4787-8419-edffb64018f2" as UUID,
    "2": "cab14c54-2e1e-40f9-9994-75e42e4359db" as UUID,
    "3": "29ab26b1-5dad-463c-954a-8ae8848f397a" as UUID,
};

//------------------------------------------------------------------------------
// Read each pivot's initial pose once, then update only the driven rotation axis.
//------------------------------------------------------------------------------
const pivot_rest_euler = new Map<string, Vec3>();

async function readPivotRestPoses(scene: AgentScene): Promise<void> {
    for (const [id, entity_uuid] of Object.entries(PIVOT_ENTITIES)) {
        const entity = await scene.findEntity({
            entity_uuid,
            linkage: ARM_LINKAGE,
        });
        const euler = entity?.getComponent("local_transform")?.eulerOrientation;
        if (euler) {
            pivot_rest_euler.set(id, [...euler] as Vec3);
        }
    }
}

//------------------------------------------------------------------------------
// Calculate pivot rotation: rest pose with driven axis updated.
//------------------------------------------------------------------------------
function pivotEuler(id: string, angle: number): Vec3 | null {
    const rest = pivot_rest_euler.get(id);
    if (!rest) {
        return null;
    }
    const axis = PIVOT_ROTATION_AXIS[id] ?? [0, 1, 0];
    const driven = axis.findIndex(component => component !== 0);
    const euler = [...rest] as Vec3;
    euler[driven] = (Math.sign(axis[driven]) * angle * 180) / Math.PI;
    return euler;
}

const ARM_MAPPING: EventMapping = {
    channel: ARM_CHANNEL,

    schema: {
        type: "object",
        properties: {
            axis: { type: "number" },
            angle: { type: "number" },
        },
        required: ["axis", "angle"],
    },

    entities: {
        linkage: ARM_LINKAGE,
        byUuid: PIVOT_ENTITIES,
    },

    updates: event => {
        const { axis, angle } = event.payload as ArmJointTelemetry;
        const id = String(axis);
        const eulerOrientation = pivotEuler(id, angle);
        if (eulerOrientation === null) {
            return null;
        }
        return {
            id,
            update: { local_transform: { eulerOrientation } },
        };
    },
};

//------------------------------------------------------------------------------
// Wrap the event sink to observe events before processing.
//------------------------------------------------------------------------------
function observedSink({
    sink,
    onEvent,
}: {
    sink: EventSink;
    onEvent: (event: IngestEvent) => void;
}): EventSink {
    return {
        ingest(event: IngestEvent): void | Promise<void> {
            onEvent(event);
            return sink.ingest(event);
        },
    };
}

//------------------------------------------------------------------------------
// Toggle broadcast state of companion entities based on label visibility.
//
// `auto_broadcast` is what decides whether an entity joins the persist list the
// broadcast loop flushes
//------------------------------------------------------------------------------
function vehicleBroadcastSync(): (params: {
    ingestion: SceneIngestion;
    ids: Array<string>;
    auto_broadcast: boolean;
}) => Promise<void> {
    const companions = new Map<string, AgentEntity>();
    let is_resolving = false;

    return async ({ ingestion, ids, auto_broadcast }) => {
        const scene = ingestion.agent.livelinks[0]?.scene;
        if (!scene) {
            return;
        }

        // Retry missing companions on next call.
        const missing = ids.filter(id => !companions.has(id));
        if (missing.length > 0 && !is_resolving) {
            is_resolving = true;
            try {
                for (const id of missing) {
                    const [entity] = await scene.findEntitiesByNames({
                        entity_names: [broadcastEntityName(id)],
                    });
                    if (entity) {
                        companions.set(id, entity);
                    }
                }
            } finally {
                is_resolving = false;
            }
        }

        for (const entity of companions.values()) {
            if (entity.auto_broadcast !== auto_broadcast) {
                entity.auto_broadcast = auto_broadcast;
            }
        }
    };
}

//------------------------------------------------------------------------------
// Recording metadata (one event per line).
//------------------------------------------------------------------------------
const RECORDING = {
    title: "x-agent-data-ingestion-recording.json",
    note: "1 forklift + 2 drones + 1 arm, 30 Hz, 31 s loop",
    text: RECORDING_TEXT,
    event_count: RECORDING_TEXT.split("\n").filter(line =>
        line.trimStart().startsWith("{"),
    ).length,
};

//------------------------------------------------------------------------------
// Create ingestion: agent, pipeline, and playback source.
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

        // The two vehicle mappings select the same channel, and both run: an event is offered to
        // every mapping that matches it, not just the first. `ARM_MAPPING` selects a different
        // channel entirely, and demonstrates the other entity strategy — see its own comment.
        pipeline: new IngestionPipeline({
            mappings: [VEHICLE_MAPPING, VEHICLE_BROADCAST_MAPPING, ARM_MAPPING],
            onError,

            // The default, spelled out because the overlay depends on it: every entity the
            // pipeline resolves or spawns starts with `auto_broadcast = false`, so nothing an
            // ingestion drives is persisted behind your back. `vehicleBroadcastSync()` above is
            // what lifts it, and only ever on the companion entities.
            manage_auto_broadcast: true,
        }),

        // A source can be a `TransportSpec` — `{ kind: "playback", config: { source } }` — or, as
        // here, a factory receiving the sink to push into. The factory form is what lets us slip
        // the observing sink in between. The transport is still owned by the ingestion: started on
        // the first ready session, stopped with it.
        sources: [
            (sink: EventSink) =>
                new PlaybackTransport(
                    {
                        // In Node this would read `{ file_path: "./x-agent-data-ingestion-recording.json" }`,
                        // or `{ url }`, or a stream — the replay is identical.
                        source: RECORDING.text,
                        speed,
                        loop: true,
                    },
                    observedSink({ sink, onEvent }),
                ),
        ],
    });

    ingestion.addEventListener("on-error", ({ error }) => onError(error));

    // The arm's pivots are entities the ingestion drives but does not create, and
    // it only drives one rotation axis of each: the rest of their authored pose
    // has to be read back before their first event can be turned into a
    // transform. See `pivot_rest_euler` above.
    ingestion.addEventListener("on-session-bound", ({ livelink }) => {
        readPivotRestPoses(livelink.scene).catch(onError);
    });

    return ingestion;
}

//==============================================================================
// DataIngestion: a thin React wrapper that starts/stops the runtime-agnostic
// ingestion above and renders what it is doing.
//==============================================================================

const SPEEDS = [
    { value: 0.5, label: "0.5×" },
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 5, label: "5×" },
];

//------------------------------------------------------------------------------
function DataIngestion({
    sessionInfo,
    areLabelsVisible,
    setAreLabelsVisible,
}: {
    sessionInfo: SessionInfo | null;
    areLabelsVisible: boolean;
    setAreLabelsVisible: (areLabelsVisible: boolean) => void;
}) {
    const [isStarted, setIsStarted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [stats, setStats] = useState<IngestionStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Buffer events and publish on timer (not per event).
    const { rows, onEvent, reset } = useEventTrace({
        describe: describePayload,
    });

    // Track playback progress (updated every 100ms, not per event).
    const replayed = useRef(0);
    const [cursor, setCursor] = useState(0);

    // Track vehicle IDs from event stream.
    const vehicle_ids = useRef<Set<string>>(new Set());
    const are_labels_visible = useRef(areLabelsVisible);
    are_labels_visible.current = areLabelsVisible;

    const onRecordingEvent = useCallback(
        (event: IngestEvent) => {
            replayed.current += 1;
            if (event.channel.startsWith(VEHICLE_CHANNEL_PREFIX)) {
                const id = deviceId(event.channel);
                if (id !== null) {
                    vehicle_ids.current.add(id);
                }
            }
            onEvent(event);
        },
        [onEvent],
    );

    const startIngestion = useCallback(async () => {
        if (!sessionInfo) {
            throw new Error("Session info is not available");
        }

        // Connect to the viewer's session.
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

            // The one tuning an ingestion agent actually needs.
            headless_client: {
                // Writes are not sent one by one: a timer flushes whatever
                // changed, 30 times a second by default, and only the last value
                // written between two flushes goes out. The recording is 30 Hz,
                // so the default only just keeps up — 60 leaves room, and still
                // covers the 2× replay. (At 5× the samples arrive faster than any
                // flush rate can follow, and the motion simply gets coarser.)
                updatesPerSecond: 60,
                // The other loop: the one that persists `auto_broadcast` entities
                // so other clients see them. It defaults to 1, which is why a
                // label driven this way lurches once a second. Only the companion
                // entities carrying the labels are on that list — the pipeline
                // sets `auto_broadcast = false` on everything it drives, so the
                // vehicles never join it. It cannot usefully go above
                // `updatesPerSecond`, which is the loop that fills the list.
                broadcastsPerSecond: 20,
            },

            // Leave session 1 minute after all viewers disconnect.
            leave_on_condition: { after_seconds: 60 },
        };

        const ingestion = createIngestion({
            config,
            speed,
            onEvent: onRecordingEvent,
            onError: reported => setError(reported.message),
        });
        await ingestion.start();

        return ingestion;
    }, [sessionInfo, speed, onRecordingEvent]);

    // Restart ingestion on speed change.
    useEffect(() => {
        if (!isStarted || !sessionInfo) {
            return;
        }

        let ingestion: SceneIngestion | null = null;
        let isUnmounted = false;

        setError(null);
        reset();
        replayed.current = 0;
        setCursor(0);

        // Learn fleet from stream again.
        vehicle_ids.current = new Set();
        const syncBroadcast = vehicleBroadcastSync();

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

        const poll = setInterval(() => {
            setStats(ingestion?.stats ?? null);
            setCursor(replayed.current);

            // Sync broadcast state for all vehicles.
            if (ingestion) {
                void syncBroadcast({
                    ingestion,
                    ids: Array.from(vehicle_ids.current),
                    auto_broadcast: are_labels_visible.current,
                });
            }
        }, 100);

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
            {/* All panels stacked in one column, so the rest of the viewport stays clear. The
                width cap is what keeps them readable on a phone rather than a sliver. */}
            <div className="absolute top-4 left-4 z-50 w-104 max-w-[calc(100vw-2rem)] flex flex-col gap-2">
                <SourceTextPanel
                    title={RECORDING.title}
                    note={RECORDING.note}
                    text={RECORDING.text}
                    activeLine={
                        isStarted && cursor > 0
                            ? ((cursor - 1) % RECORDING.event_count) + 1
                            : null
                    }
                />
                <EventTracePanel rows={rows} />
                <IngestionStatsPanel stats={stats} />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
                {error && (
                    <p className="px-3 py-1 bg-[black] text-[#ff6363] text-xs rounded-sm">
                        {error}
                    </p>
                )}
                <div className="flex items-stretch gap-3">
                    <button
                        className="button button-primary"
                        onClick={() => setIsStarted(prev => !prev)}
                    >
                        {isStarted ? "Stop" : "Start"}
                    </button>

                    <SpeedSelect
                        options={SPEEDS}
                        value={speed}
                        onChange={setSpeed}
                        label="Replay speed"
                    />

                    {/* Toggle overlay (view only); manages broadcast state. */}
                    <button
                        className={`px-2 py-1 rounded-sm text-center cursor-pointer text-xs ${
                            areLabelsVisible
                                ? "bg-white text-[#333]"
                                : "bg-[#333] text-white"
                        }`}
                        aria-pressed={areLabelsVisible}
                        onClick={() => setAreLabelsVisible(!areLabelsVisible)}
                    >
                        telemetry
                    </button>
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
    const { pos, yaw, state } = payload as {
        pos?: Vec3;
        yaw?: number;
        state?: string;
    };
    if (!pos) {
        return JSON.stringify(payload);
    }
    return [
        `pos [${pos.map(n => n.toFixed(2)).join(", ")}]`,
        yaw === undefined ? null : `yaw ${yaw.toFixed(2)}`,
        state ?? null,
    ]
        .filter(part => part !== null)
        .join(" ");
}
