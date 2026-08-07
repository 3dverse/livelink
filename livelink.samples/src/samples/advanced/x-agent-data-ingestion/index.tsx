//------------------------------------------------------------------------------
// This sample drives a 3dverse scene from *recorded event streams*, using the
// data-ingestion layer of the `@3dverse/livelink-agent` package.
//
// Nothing here talks to a broker. A dump of what a fleet — and one stationary
// machine — published, the exact shape you would capture off MQTT, is replayed
// by a `PlaybackTransport` at its recorded pace, into one pipeline:
//
//   • `x-agent-data-ingestion-recording.json` — a forklift and two drones over a
//                                20 × 30 m floor, 30 Hz each, plus the four-pivot
//                                joint stream of a stationary robotic arm.
//                                A vehicle is a *sub-scene instance*: its mapping
//                                spawns it with a `scene_ref`, so what shows up
//                                in the viewport is a real asset, not a proxy
//                                cube. Every frame carries telemetry besides the
//                                pose — speed, battery, state, and what the kind
//                                of vehicle warrants. The arm is the opposite
//                                case: its four pivots are entities *already* in
//                                the scene, so its mapping resolves them by a
//                                fixed id → UUID table (`byUuid`) instead of
//                                spawning anything — see `ARM_MAPPING` below.
//
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
//                         what the ingestion does to the scene. Behind the
//                         "telemetry" button a `DOM3DOverlay` floats a readout
//                         over every vehicle, and it gets there the long way
//                         round: the mapping writes the readings onto a `tags`
//                         component, and the viewport reads them back off the
//                         scene, as any other client in the session would. It
//                         never touches the event stream — which is why the
//                         button has to reach into the agent, and why the tags go
//                         on a *companion* entity rather than the vehicle. See
//                         `VEHICLE_BROADCAST_MAPPING` below.
//   • <DataIngestion/>  — runs the ingestion. It does no rendering at all: it
//                         only maps events onto entities, exactly like a
//                         server-side process would.
//   • the overlay panels — stacked on the left, all collapsible: the recording
//                         with a cursor on the event being replayed, the live
//                         event trace, and the pipeline counters.
//
// IMPORTANT: everything under the "Ingestion" banner is plain TypeScript with
// **no React or DOM dependency**. The very same code can run in any JS runtime —
// most notably as a Node.js script, where `source` would be
// `{ file_path: "./x-agent-data-ingestion-recording.json" }` instead.
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
// The recorded event stream, imported as raw text: this exact string is what the
// transport replays, and what the left panel displays. It is generated —
// `npm run generate:x-agent-data-ingestion` in `livelink.clients/livelink.agent/samples/`
// rewrites it; edit the script there to retune the motion.
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

    // The labels belong to the viewport and their switch belongs with the other
    // controls, so the two ends of the page share this one piece of state. Off to
    // begin with: showing them costs the session a broadcast per vehicle per
    // frame, which is precisely what an ingestion agent is built to avoid.
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
// `tags` is a flat list of strings, so the readings come back out of it the way
// they went in.
//------------------------------------------------------------------------------
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
// The readouts floating over the fleet.
//
// Nothing here knows the recording exists. The entities are found in the scene by
// the component the ingestion tagged them with, and every value on a label — where
// to draw it included — was read back off the scene, the same thing a dashboard
// opened on another machine would see.
//------------------------------------------------------------------------------
function VehicleLabels() {
    // Nothing is there when the page opens: the agent spawns the companions when
    // the ingestion starts, and deletes them when it stops. This is the one
    // provider that keeps its list live off the scene's own
    // `on-entities-created`/`on-entities-deleted` events, so the labels come and
    // go with the "Start ingestion" button on their own. The second argument
    // re-renders them on a `tags` write; the anchor watches the transform itself.
    const { entities } = useEntities({ mandatory_components: ["tags"] }, [
        "tags",
    ]);

    return entities.map(entity => (
        <VehicleLabel key={entity.id} entity={entity} />
    ));
}

//------------------------------------------------------------------------------
// One vehicle's label, anchored on the companion entity the ingestion drives.
//
// That entity is already parked at the height the readout should float at, so
// there is nothing to offset here: `center-bottom` rests the bottom edge of the
// card on it and the anchor keeps it that size on screen at any distance.
//------------------------------------------------------------------------------
function VehicleLabel({ entity }: { entity: Entity }) {
    const telemetry = parseTags(entity.tags?.value ?? []);

    // Anything else in the scene that happens to carry tags is none of our
    // business.
    if (!telemetry.kind) {
        return null;
    }

    // Speed is a display concern only: to one decimal place, both vehicle kinds
    // stay under 10 m/s so this is also a fixed length, e.g. "3.2 m/s".
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
                                {/* Fixed width so a value gaining or losing a
                                    digit (e.g. "35 %" vs "100 %") never shifts
                                    the columns after it. */}
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
// The `index`-th `/`-separated segment of a channel, or null when the channel has no such segment.
// A negative index counts back from the end, `-1` being the last segment.
//------------------------------------------------------------------------------
function channelSegment(channel: string, index: number): string | null {
    const segments = channel.split("/");
    return segments[index < 0 ? segments.length + index : index] ?? null;
}

//------------------------------------------------------------------------------
// The quaternion for a recorded attitude: yaw about Y (up), then pitch about X,
// then roll about the forward axis. A device that only reports a heading passes
// `yaw` alone and stays level; a drone reports all three and leans into its turns.
//------------------------------------------------------------------------------
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
// The id of whatever published the event — a device, a forklift, a drone — is the
// middle segment of the recorded channel: the same routing key the broker used,
// preserved by the playback.
//------------------------------------------------------------------------------
function deviceId(channel: string): string | null {
    return channelSegment(channel, 1);
}

//------------------------------------------------------------------------------
// The vehicle stream: spawn on the first event for an id, move on every one
// after. What it spawns is a **sub-scene** — a `scene_ref` component instantiates
// a whole authored asset under the entity, so the ingestion drives an actual
// forklift and actual drones rather than proxy cubes. `+` matches exactly one
// channel segment.
//
// A vehicle publishes more than a pose: how fast it is going, how full its
// battery is, what it is doing, and — depending on what it is — its load and mast
// height or its altitude and radio link. None of that lands on *this* entity
// though: it goes on a companion entity spawned by the mapping below, for reasons
// that are entirely about what the two flush loops cost.
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
// The telemetry, as the `tags` component carries it: a flat list of strings, so
// each reading goes in as `key=value` and comes back out with `parseTags()` at
// the other end. `kind` is what tells our vehicles apart from anything else in
// the scene that happens to be tagged.
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
// Not every field deserves the stream's rate. A position has to arrive 30 times a
// second or the motion judders; a text readout re-drawn that often only costs a
// component flush and a broadcast to every client watching. So the pose goes in
// on every event and the tags four times a second, on the wall clock — the point
// is to cap the real-time write rate, whatever speed the replay runs at.
//------------------------------------------------------------------------------
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
// The same events again, this time spawning the entity the *clients* follow.
//
// A client writes to the session through two loops, and they are not the same
// pipe. The update loop flushes every dirty entity ~30 times a second so the
// renderer can draw it; the broadcast loop flushes only `auto_broadcast` entities,
// **once a second by default**, and it flushes them with `persist: true` — it
// writes them to the scene. So a viewport's own copy of an ingested entity is a
// second stale, and turning that rate up means persisting whatever is on the list
// thirty times a second. Doing that to a `scene_ref` root — a whole instantiated
// sub-scene — is what makes the rendered motion stutter.
//
// So the two jobs go to two entities. The vehicle above drives the renderer and is
// never broadcast. This one is empty: a name, a position and the telemetry, small
// enough that persisting it 30 times a second costs nothing. It has no mesh, so it
// is invisible; the only thing that ever looks at it is the DOM overlay.
//
// It is spawned at the scene root rather than under its vehicle *because* the
// vehicle is not broadcast: a child's world position is resolved through its
// parent's matrix, and every client's copy of that parent is frozen at the pose it
// was created with. Parented, every label would sit where its vehicle started.
//------------------------------------------------------------------------------

// How high above the vehicle's own origin the readout floats. The broadcast entity
// is placed there directly, so the label is anchored on a real point in the world
// rather than pushed up the screen by a guess at the camera distance.
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

    // Same events, already validated by the mapping above — every mapping whose
    // channel matches gets the event, in the order they were registered.
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
                    // Spawned *with* its tags, not given them on the next event:
                    // the viewer picks these entities up by the components they
                    // are created with.
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
// The arm: a stationary 4-DOF machine, its four pivots already authored in the
// scene rather than spawned. Its stream reports one axis per event — `{ axis,
// angle }` — so unlike a vehicle, the id this mapping resolves comes from the
// *payload*, not the channel, and it resolves against entities the mapping
// never creates.
//
// That is `byUuid`: a fixed id → entity UUID table, the right strategy for a
// known, closed population (the four pivots of one machine) that already
// exists. Fill in the four UUIDs below with the pivot entities from your own
// copy of the scene — until then the resolver logs one "not found" warning per
// pivot and otherwise ignores their events.
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
// The pose the scene authored each pivot with.
//
// A joint reports one angle, about one axis — so it drives exactly one of the
// three components of its pivot's rotation, and the other two have to come from
// somewhere. Sending a bare rotation about the driven axis alone would zero
// them, folding the arm flat the moment the first event lands. So the authored
// pose is read off the scene once, and only the driven component is replaced.
//
// Re-reading it on a later run is harmless: the only component the ingestion
// ever wrote is the one that gets replaced anyway.
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
// Where a joint angle puts its pivot: the rest pose with the driven component
// overwritten. `eulerOrientation` is in degrees and ordered [X, Y, Z] — the same
// order the rotation axis is written in, so the axis' one non-zero entry is the
// index to write. Null until the rest pose has been read, which drops a frame or
// two at the very start rather than flattening the arm.
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
// An `EventSink` that reports every event before passing it on. `SceneIngestion` *is* the real
// sink, so wrapping it is all it takes to watch the stream go by — no SDK hook needed.
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
// Putting the companion entities on the broadcast list.
//
// `auto_broadcast` is what decides whether an entity joins the persist list the
// broadcast loop flushes — the pipeline holds it at `false` for everything it
// touches, so nothing an ingestion drives is persisted behind your back. The
// vehicles stay that way for good. Their companions are switched on and off with
// the readouts: nobody is reading them while the overlay is hidden, so nothing
// needs sending.
//
// Returns a function to call whenever the wanted state may have drifted. The
// entities are looked up by the names the mapping spawned them under and kept: a
// run of calls costs one lookup rather than one apiece.
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

        // An id turns up on the stream a moment before the pipeline has finished
        // spawning its entity, so a lookup can come back empty. Whatever is still
        // missing is simply retried on the next call.
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
// The recording being replayed. It holds one event per line, so an event index
// *is* a line index in the panel that displays it (line 0 being the opening
// bracket).
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
// Build the ingestion: an agent to attach to the session, a pipeline holding the
// mappings, and the playback source feeding them.
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

    // Events arrive up to ~330 times a second: the trace buffers them and
    // publishes on a timer rather than setting state per event.
    const { rows, onEvent, reset } = useEventTrace({
        describe: describePayload,
    });

    // How far into each recording its own transport has got, counted per event
    // and published on the same 100 ms tick as the stats below — the panels only
    // need a cursor, not a re-render per event.
    const replayed = useRef(0);
    const [cursor, setCursor] = useState(0);

    // The stream defines the fleet, here as much as in the mapping: a vehicle is
    // known by the id its channel carried. Held in a ref and read on the tick
    // below, where the broadcast state is reconciled.
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
            // gets its own flush. Rates are capped at 125 Hz (an 8 ms interval)
            // because the client does not support a faster timer.
            headless_client: {
                // Generated recordings are 30 Hz, so the flush rate has to be at
                // least that to avoid dropping samples.
                updatesPerSecond: 40,
                // `broadcastsPerSecond` is the *other* loop — the one that persists
                // `auto_broadcast` entities for the other clients — and it defaults to
                // 1, which is why anything watching an ingested entity from another
                // client sees it lurch once a second. Raising it is only affordable
                // because the only things on that list are the empty companion
                // entities; the vehicles themselves never join it.
                broadcastsPerSecond: 20,
            },
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

    // Restarts on a speed change: the source is fixed when the ingestion is built
    // and the transport paces off the recorded timestamps when it starts, so a
    // new speed means a new replay.
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

        // A fresh run means fresh entities — the old ones went with the agent
        // that spawned them — so the fleet is learnt again from the stream.
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

            // Reconciled rather than fired on the button: a vehicle that spawns
            // while the labels are already on has to be caught too, and settling
            // both cases on the same tick means neither has to know about the
            // other. Once every vehicle matches, this costs a set difference.
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

                    {/* The overlay is a view of the scene, not a source: switching
                        it off leaves the ingestion running untouched. It does take
                        the companion entities off the broadcast list though —
                        nobody is reading them while it is hidden. */}
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
