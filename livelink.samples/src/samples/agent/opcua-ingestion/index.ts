//------------------------------------------------------------------------------
// Headless agent: drives a 3dverse scene from a live OPC UA server.
// Runs as Node.js (OPC UA is raw TCP, not browser-compatible).
//
// Run the server (https://github.com/Azure-Samples/iot-edge-opc-plc):
//   docker run ... mcr.microsoft.com/iotedge/opc-plc:latest --pn=50000 --autoaccept --unsecuretransport --ct=50 --sc=100
//
//
// Run the agent from livelink.samples directory:
//   npm run agent-sample:opcua
//
// Configured via environment: OPCUA_ENDPOINT, SCENE_ID, etc.
//------------------------------------------------------------------------------
import { Agent, IngestionPipeline, SceneIngestion, createTransport } from "@3dverse/livelink-agent";
import type {
    AgentConfig,
    ComponentsManifest,
    EventMapping,
    OpcUaTransportConfig,
    SessionInfo,
} from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
import { asNumber, axisQuaternion, yawQuaternion } from "../lib/ingestion";
import { openSessionInEditor } from "../lib/open-in-editor";

//------------------------------------------------------------------------------
// Read from .env or shell environment.
const TOKEN = process.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = process.env.SCENE_ID ?? "1c7da705-5532-4fdb-9b31-4034fdbf5cde";
const SESSION_ID = process.env.SESSION_ID;
const ENDPOINT_URL = process.env.OPCUA_ENDPOINT ?? "opc.tcp://localhost:50000";

// Cube mesh and materials (shared with other agent samples).
const MESH_REF = "0577814f-4677-420b-89e8-1e5a4dd56914";

const MATERIAL_REF = {
    light: "5bd5d2c5-65d3-4cdb-adb1-c85ae1502840",
    green: "afbcef75-7c52-4a90-b6e6-d19dcc04c3ad",
    dark: "c9650d73-0f0b-4064-843f-ff0bb8d506e7",
    orange: "78b48c3a-9988-433a-9237-9ea5dc7a57e5",
} as const;

// OPC UA cycle in milliseconds (must match docker --ct flag).
// Server typically floors publishing interval at 50 ms.
const CYCLE_MS = Number(process.env.OPCUA_CYCLE_MS ?? 50);

// Samples per second (used to convert per-cycle counters to rates).
const SAMPLES_PER_SECOND = 1000 / CYCLE_MS;

// OPC UA namespace (resolved from server at startup).
const OPC_PLC_NAMESPACE_URI = "http://microsoft.com/Opc/OpcPlc/";
const OPC_PLC_NAMESPACE_FALLBACK = 3;

// Timeout for namespace lookup before transport takes over.
const NAMESPACE_LOOKUP_TIMEOUT_MS = 10_000;

//==============================================================================
// Mappings: one per signal, each spawning the part of the cell it drives.
//==============================================================================

//------------------------------------------------------------------------------
// Spawn a machine part (one fixed entity per mapping).
function machinePart({ name, components }: { name: string; components: ComponentsManifest }): EventMapping["entities"] {
    return {
        spawn: {
            name,
            components: {
                debug_name: { value: name },
                mesh_ref: { value: MESH_REF },
                material_ref: { value: MATERIAL_REF.light },
                ...components,
            },
            options: { delete_on_client_disconnection: true },
        },
    };
}

//------------------------------------------------------------------------------
// Extract numeric value from OPC UA sample payload.
function sampleValue(payload: unknown): number | null {
    return asNumber((payload as { value?: unknown }).value);
}

//------------------------------------------------------------------------------
// Rotor: counter to rotation (rate-based, cycle-aware).
// Shared by rotor and tank (both read "plc/counter").
//------------------------------------------------------------------------------
const SECONDS_PER_TURN = 6;
const RADIANS_PER_STEP = (2 * Math.PI) / (SECONDS_PER_TURN * SAMPLES_PER_SECOND);

const ROTOR_MAPPING: EventMapping = {
    channel: "plc/counter",

    entities: machinePart({
        name: "Rotor",
        components: {
            local_transform: { position: [0, 1.4, 0], scale: [1.6, 0.25, 0.25] },
        },
    }),

    updates: event => {
        const value = sampleValue(event.payload);
        if (value === null) {
            return null;
        }
        // Modulo to prevent precision loss from large counters.
        const steps_per_turn = SECONDS_PER_TURN * SAMPLES_PER_SECOND;
        const yaw = (value % steps_per_turn) * RADIANS_PER_STEP;
        return {
            id: "rotor",
            update: { local_transform: { orientation: yawQuaternion(yaw) } },
        };
    },
};

//------------------------------------------------------------------------------
// Piston: sine wave with injected spikes (clamped to show over-travel).
//------------------------------------------------------------------------------
const PISTON_STROKE = 2.5;
const PISTON_END_STOP = 3.2;
const PISTON_MAPPING: EventMapping = {
    channel: "plc/piston/stroke",

    schema: {
        type: "object",
        properties: { value: { type: "number" } },
        required: ["value"],
    },

    entities: machinePart({
        name: "Piston",
        components: {
            local_transform: { position: [0, 0.5, 2], scale: [0.5, 0.5, 0.5] },
            material_ref: { value: MATERIAL_REF.dark },
        },
    }),

    updates: event => {
        const value = sampleValue(event.payload);
        if (value === null) {
            return null;
        }
        const stroke = (value / 100) * PISTON_STROKE;
        const clamped = Math.max(-PISTON_END_STOP, Math.min(PISTON_END_STOP, stroke));
        return {
            id: "piston",
            update: { local_transform: { position: [clamped, 0.5, 2] } },
        };
    },
};

//------------------------------------------------------------------------------
// Gauge needle: sine with dips (mapped to ±90° rotation).
//------------------------------------------------------------------------------
const GAUGE_MAPPING: EventMapping = {
    channel: "plc/gauge/pressure",

    entities: machinePart({
        name: "Needle",
        components: {
            local_transform: {
                position: [-2.5, 1.5, 0],
                scale: [0.08, 1, 0.08],
            },
            material_ref: { value: MATERIAL_REF.orange },
        },
    }),

    updates: event => {
        const value = sampleValue(event.payload);
        if (value === null) {
            return null;
        }
        // ±100 over the sine's range, mapped to ±90° about the depth axis.
        const angle = (Math.max(-100, Math.min(100, value)) / 100) * (Math.PI / 2);
        return {
            id: "needle",
            update: { local_transform: { orientation: axisQuaternion("z", angle) } },
        };
    },
};

//------------------------------------------------------------------------------
// Tank: synthesized from counter (modulo to create sawtooth level).
// No extra subscription or server configuration needed.
//------------------------------------------------------------------------------
const TANK_FILL_SECONDS = 5;
const TANK_STEPS = TANK_FILL_SECONDS * SAMPLES_PER_SECOND;

const TANK_MAPPING: EventMapping = {
    channel: "plc/counter",

    entities: machinePart({
        name: "Tank",
        components: {
            local_transform: { position: [2.5, 0.1, 0], scale: [0.8, 0.2, 0.8] },
            material_ref: { value: MATERIAL_REF.green },
        },
    }),

    updates: event => {
        const value = sampleValue(event.payload);
        if (value === null) {
            return null;
        }
        // Sawtooth: counter position within one fill cycle (0..1).
        const level = (value % TANK_STEPS) / TANK_STEPS;
        const height = 0.2 + level * 2.5;
        return {
            id: "tank",
            update: {
                local_transform: {
                    // Lift by half height so base stays on floor.
                    position: [2.5, height / 2, 0],
                    scale: [0.8, height, 0.8],
                },
            },
        };
    },
};

//------------------------------------------------------------------------------
// Lamps: boolean state toggles show/hide for two entities.
//------------------------------------------------------------------------------
const LAMP_MAPPING: EventMapping = {
    channel: "plc/lamp/state",

    entities: {
        spawn: {
            name: "Lamp{id}",
            components: ({ id }): ComponentsManifest => ({
                debug_name: { value: `Lamp${id}` },
                mesh_ref: { value: MESH_REF },
                material_ref: {
                    value: id === "Green" ? MATERIAL_REF.green : MATERIAL_REF.orange,
                },
                local_transform: {
                    position: [0, 2.6, id === "Green" ? -0.4 : 0.4],
                    scale: [0.3, 0.3, 0.3],
                },
            }),
            options: { delete_on_client_disconnection: true },
        },
    },

    updates: event => {
        const { value } = event.payload as { value: unknown };
        if (typeof value !== "boolean") {
            return null;
        }
        return [
            { id: "Green", update: value ? "show" : "hide" },
            { id: "Red", update: value ? "hide" : "show" },
        ];
    },
};

//==============================================================================
// Transport: the OPC UA subscription itself.
//==============================================================================

//------------------------------------------------------------------------------
// Map OPC UA node IDs to readable channel names (for mapping selectors).
function transportConfig(namespace_index: number): OpcUaTransportConfig {
    const node = (identifier: string): string => `ns=${namespace_index};s=${identifier}`;

    return {
        endpoint_url: ENDPOINT_URL,

        // Match server's simulation cycle (must match --ct flag).
        publishing_interval: CYCLE_MS,
        sampling_interval: CYCLE_MS,

        nodes: [
            // Four nodes, five parts (rotor and tank share counter).
            { node_id: node("StepUp"), channel: "plc/counter" },
            { node_id: node("SpikeData"), channel: "plc/piston/stroke" },
            { node_id: node("DipData"), channel: "plc/gauge/pressure" },
            { node_id: node("AlternatingBoolean"), channel: "plc/lamp/state" },
        ],
    };
}

//------------------------------------------------------------------------------
// Resolve namespace index from server (fallback to configured or default).
async function resolveNamespaceIndex(): Promise<number> {
    const configured = process.env.OPCUA_NS;
    if (configured !== undefined) {
        return Number(configured);
    }

    try {
        return await withTimeout(readNamespaceIndex(), NAMESPACE_LOOKUP_TIMEOUT_MS);
    } catch (error) {
        console.warn(
            `[opcua-agent] Could not read the namespace array of ${ENDPOINT_URL} (${error}). ` +
                `Assuming ns=${OPC_PLC_NAMESPACE_FALLBACK}; set OPCUA_NS to override. ` +
                `If the server is simply not up yet, the transport will keep retrying.`,
        );
        return OPC_PLC_NAMESPACE_FALLBACK;
    }
}

//------------------------------------------------------------------------------
async function readNamespaceIndex(): Promise<number> {
    const { OPCUAClient, AttributeIds } = await import("node-opcua-client");
    const client = OPCUAClient.create({
        endpointMustExist: false,
        // Single attempt (don't retry on failure).
        connectionStrategy: { initialDelay: 500, maxDelay: 1_000, maxRetry: 0 },
    });

    try {
        await client.connect(ENDPOINT_URL);
        const session = await client.createSession();
        try {
            // Read standard Server_NamespaceArray node.
            const { value } = await session.read({
                nodeId: "ns=0;i=2255",
                attributeId: AttributeIds.Value,
            });
            const namespaces = (value.value ?? []) as Array<string>;
            const index = namespaces.indexOf(OPC_PLC_NAMESPACE_URI);
            if (index < 0) {
                throw new Error(
                    `it publishes no ${OPC_PLC_NAMESPACE_URI} namespace, only ${namespaces.join(", ")} — ` +
                        `is this really an opc-plc server?`,
                );
            }
            return index;
        } finally {
            await session.close();
        }
    } finally {
        await client.disconnect();
    }
}

//------------------------------------------------------------------------------
function withTimeout<T>(work: Promise<T>, milliseconds: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const expiry = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${milliseconds} ms`)), milliseconds);
    });
    return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

//==============================================================================
// Wiring and lifecycle.
//==============================================================================

//------------------------------------------------------------------------------
function agentConfig({ token }: { token: string }): AgentConfig {
    return {
        scene_id: SCENE_ID,
        token,

        // Persistent session (viewers can find and join).
        is_transient: false,

        // Pin to existing session if SESSION_ID is set.
        ...(SESSION_ID
            ? {
                  session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) =>
                      sessions.find(s => s.session_id === SESSION_ID) ?? null,
              }
            : {}),

        // Writes are not sent one by one: a timer flushes whatever changed, 30
        // times a second by default, and only the last value written between two
        // flushes goes out. So compare the flush period to the gap between two
        // samples of the *same* entity — 50 ms here, one per node per publish,
        // not the 100 events a second the five parts add up to. The default
        // keeps up fine; 60 just shortens the wait before a sample leaves, so
        // the motion reads more evenly.
        headless_client: { updatesPerSecond: 60 },
    };
}

//------------------------------------------------------------------------------
async function main(): Promise<void> {
    if (!TOKEN) {
        throw new Error(
            "TOKEN is not set. Put it in `.env` next to these samples (see `.env.example`) or export it, " +
                "then run `npm run opcua`.",
        );
    }

    const namespace_index = await resolveNamespaceIndex();
    console.log(`[opcua-agent] opc-plc nodes are at ns=${namespace_index} on ${ENDPOINT_URL}`);

    const ingestion = new SceneIngestion({
        agent: new Agent({ config: agentConfig({ token: TOKEN }) }),
        pipeline: new IngestionPipeline({
            mappings: [ROTOR_MAPPING, PISTON_MAPPING, GAUGE_MAPPING, TANK_MAPPING, LAMP_MAPPING],
            onError: error => console.error("[opcua-agent]", error),
        }),

        // Transport starts with first session and retries on failure.
        sources: [sink => createTransport({ kind: "opcua", config: transportConfig(namespace_index) }, sink)],
    });

    ingestion.addEventListener("on-error", ({ error }) => console.error("[opcua-agent]", error));
    // Session bound: ingested samples now drive the scene.
    ingestion.addEventListener("on-session-bound", ({ livelink }) => {
        console.log(
            `[opcua-agent] Driving session ${livelink.session.session_id}. ` +
                `Join it from any viewer on scene ${SCENE_ID} to watch the cell move.`,
        );
        void openSessionInEditor({
            scene_id: SCENE_ID,
            session_id: livelink.session.session_id,
            public_token: TOKEN,
        });
    });

    await ingestion.start();

    // Only report when stats change (avoid cluttering logs).
    let last_reported = 0;
    const report = setInterval(() => {
        const stats = ingestion.stats;
        if (!stats || stats.events_received === last_reported) {
            return;
        }
        last_reported = stats.events_received;
        console.log(
            `[opcua-agent] received ${stats.events_received}  applied ${stats.updates_applied}  ` +
                `written ${stats.components_written}  deduped ${stats.components_deduped}  ` +
                `drops ${JSON.stringify(stats.drops)}`,
        );
    }, 5_000);

    const shutdown = async (): Promise<void> => {
        clearInterval(report);
        console.log("[opcua-agent] Stopping...");
        await ingestion.stop();
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
}

//------------------------------------------------------------------------------
main().catch(error => {
    console.error("[opcua-agent]", error);
    process.exit(1);
});
