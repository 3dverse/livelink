//------------------------------------------------------------------------------
// A headless agent that drives a 3dverse scene from a live OPC UA server, using
// the data-ingestion layer of `@3dverse/livelink-agent`.
//
//   npm run opcua
//
// This one can only ever be a Node.js script, and that is the point: `opc.tcp://`
// is raw TCP, so `OpcUaTransport` cannot run in a page — where "MQTT Ingestion"
// next door could. It is also where an OPC UA client belongs in a real deployment
// — next to the PLC, on the plant network, with the scene as its only outbound
// connection.
//
// The server it expects is Microsoft's simulated PLC, which needs no PLC:
//
/*
    docker run --rm -it -p 50000:50000 -p 8080:8080 --name opcplc \
        mcr.microsoft.com/iotedge/opc-plc:latest \
        --pn=50000 --autoaccept --unsecuretransport \
        --ct=50 --sc=100
*/
//
//   https://github.com/Azure-Samples/iot-edge-opc-plc
//
// The last line is the only tuning: it runs the simulation at 20 Hz rather than
// the default 10 Hz, so the motion is smooth. See `CYCLE_MS`. Everything else is
// stock, and every node this agent reads is one opc-plc publishes by default.
//
// It publishes a handful of deterministic signals — a rising counter, two sine
// waves carrying injected anomalies, a wrapping counter, a toggling boolean —
// and this script maps each onto one part of a small machine cell that it spawns
// itself. The session it opens is a normal one, so any viewer pointed at the same
// scene joins it and watches the cell move.
//
// Everything is configured through the environment:
//
//   LIVELINK_TOKEN   (required)                  the 3dverse access token
//   OPCUA_ENDPOINT   opc.tcp://localhost:50000   the server to subscribe to
//   OPCUA_NS         (resolved from the server)  namespace index of the PLC nodes
//   OPCUA_CYCLE_MS   50                          must match the server's --ct
//   SCENE_ID         the shared samples scene    the scene to drive
//   SESSION_ID       (none)                      pin to a session already open
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
// `npm run opcua` reads the `.env` beside it if there is one, so the token can
// live in a file next to these scripts or come straight from the shell.
//------------------------------------------------------------------------------
const TOKEN = process.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = process.env.SCENE_ID ?? "1c7da705-5532-4fdb-9b31-4034fdbf5cde";
const SESSION_ID = process.env.SESSION_ID;
const ENDPOINT_URL = process.env.OPCUA_ENDPOINT ?? "opc.tcp://localhost:50000";

// The same cube mesh and materials the other agent samples use, so the machine
// cell needs nothing authored in the scene: this script creates every part of it.
const MESH_REF = "0577814f-4677-420b-89e8-1e5a4dd56914";

const MATERIAL_REF = {
    light: "5bd5d2c5-65d3-4cdb-adb1-c85ae1502840",
    green: "afbcef75-7c52-4a90-b6e6-d19dcc04c3ad",
    dark: "c9650d73-0f0b-4064-843f-ff0bb8d506e7",
    orange: "78b48c3a-9988-433a-9237-9ea5dc7a57e5",
} as const;

// opc-plc updates every simulated node **once per simulation cycle**, so that
// cycle is the ceiling on everything: sampling faster wins nothing, and the
// motion in the scene is a staircase of exactly that many steps a second however
// fast the agent flushes.
//
// The server's default cycle is 100 ms, and 10 Hz is visibly steppy. Hence the
// `--ct=50` in the docker command above — 20 Hz, which reads as smooth. It comes
// with `--sc=100`: a sine takes `simulationcyclecount` cycles per period, so the
// cycle count has to rise in the same proportion for the machine to keep running
// at the same speed rather than twice as fast. The two flags always move
// together, and this constant has to agree with `--ct` or the subscription asks
// for samples at a rate the server is not producing.
//
// 50 ms is where this stops, and the wall is on the OPC UA side rather than in
// the simulation: a subscription's publishing interval is a *request*, and most
// servers floor it at 50 ms — node-opcua's own server clamps there. Ask for 25
// and you are handed 50 anyway, at which point the agent is deriving every
// constant below from a rate it is not receiving. The transport says so when it
// happens, which is the whole point of it reporting the revision.
const CYCLE_MS = Number(process.env.OPCUA_CYCLE_MS ?? 50);

// Samples per second, which several mappings need in order to turn a per-cycle
// counter into a rate that does not change when the cycle does.
const SAMPLES_PER_SECOND = 1000 / CYCLE_MS;

// The namespace URI opc-plc registers its simulated nodes under. The *index* it
// ends up at is assigned by the server at startup and has changed between
// releases (ns=2 on older builds, ns=3 on current ones) — which is why it is
// read from the server rather than hardcoded. See `resolveNamespaceIndex`.
const OPC_PLC_NAMESPACE_URI = "http://microsoft.com/Opc/OpcPlc/";
const OPC_PLC_NAMESPACE_FALLBACK = 3;

// How long the namespace lookup gets before the agent gives up on it and lets the
// transport do the waiting. This is a *pre-flight*: a server that is down at boot
// is the transport's problem, and it is far better at it — it reconnects, and the
// ingestion retries the source on the next session to bind.
const NAMESPACE_LOOKUP_TIMEOUT_MS = 10_000;

//==============================================================================
// Mappings: one per signal, each spawning the part of the cell it drives.
//==============================================================================

//------------------------------------------------------------------------------
// Spawning a single fixed entity is the degenerate case of `spawn`: the mapping
// only ever produces one id, so exactly one entity is ever created for it. That
// is what lets this whole cell run against an empty scene.
//
// `delete_on_client_disconnection` means the parts vanish when this script
// stops, leaving the scene as it was found.
//------------------------------------------------------------------------------
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
// The value every one of these nodes publishes, under the envelope the OPC UA
// transport wraps each sample in.
//------------------------------------------------------------------------------
function sampleValue(payload: unknown): number | null {
    return asNumber((payload as { value?: unknown }).value);
}

//------------------------------------------------------------------------------
// StepUp: a uint32 counter incremented once per simulation cycle. Turned into an
// angle, it is a shaft spinning at a rate you can read off the counter.
//
// The counter's rate *is* the cycle rate, so the angle per step is derived from
// the cycle rather than fixed: shortening the cycle then buys smoothness without
// also spinning the shaft faster.
//
// Two mappings select this one channel — the tank reads it too. Every mapping
// whose selectors match an event gets to handle it, so one PLC variable driving
// several parts costs one subscription and no coordination between them.
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
        // Reduced modulo a whole turn before scaling: a uint32 counter left to
        // grow reaches the far end of double precision, where adding one step no
        // longer changes the angle at all.
        const steps_per_turn = SECONDS_PER_TURN * SAMPLES_PER_SECOND;
        const yaw = (value % steps_per_turn) * RADIANS_PER_STEP;
        return {
            id: "rotor",
            update: { local_transform: { orientation: yawQuaternion(yaw) } },
        };
    },
};

//------------------------------------------------------------------------------
// SpikeData: a sine of amplitude 100 with spikes injected at unpredictable
// cycles. Driving a position with it makes the anomaly the one thing you cannot
// miss — the piston slides smoothly, then slams past its stroke for one frame.
//
// The spike is worth knowing the size of: it is not a nudge, it is
// `amplitude × 10`, i.e. 1000. Left unclamped the piston would be flung 25 units
// away, off camera and back, and you would see a blink rather than an over-travel.
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
// DipData: the same sine, with dips instead of spikes. A needle is the classic
// instrument for it — the dips slam it over to one side and back.
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
// A tank wants a signal that fills and empties, and opc-plc's *default* nodes do
// not offer one. `PositiveTrendData` sounds like the candidate and is not: it
// sits at exactly 100.0 until a randomly chosen phase, then creeps up by 0.1 per
// phase and never comes back down. Mapped to a level over 0..100 it is pinned
// full from the first sample, which looks exactly like a broken mapping.
//
// So the level is **synthesized from the counter** the rotor already reads:
// `StepUp modulo N` is a sawtooth, which is exactly a tank filling and being
// emptied. Deriving a display value from a raw counter is what ingestion code
// spends most of its time doing anyway, and it costs nothing here — no extra
// subscription, no extra server configuration, and it runs at the cycle rate
// like everything else.
//
// opc-plc does offer a *configurable* sawtooth in its "fast nodes"
// (`--fn --ftl --ftu --fts --vfr`), and it is a trap anywhere near this rate:
// `--vfr` under 50 ms crosses a threshold in the server where it swaps the timer
// for a different update path, and the node stops keeping up. This cycle sits
// right on that boundary, so derive rather than configure.
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
        // The sawtooth: the counter's position within one fill, as a fraction.
        const level = (value % TANK_STEPS) / TANK_STEPS;
        const height = 0.2 + level * 2.5;
        return {
            id: "tank",
            update: {
                local_transform: {
                    // Scaling happens about the entity's origin, so the tank has
                    // to be lifted by half its height to keep its base on the floor.
                    position: [2.5, height / 2, 0],
                    scale: [0.8, height, 0.8],
                },
            },
        };
    },
};

//------------------------------------------------------------------------------
// AlternatingBoolean: one boolean, two lamps. This is the mapping worth reading:
// one event returns an **array** of updates, and each of them is a whole-entity
// directive (`"show"` / `"hide"`) rather than a component patch — the form to
// use when an event changes whether an entity is there at all.
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
// Each node is aliased to a readable channel, which is the whole reason
// `OpcUaNodeSpec.channel` exists: a raw node id is one opaque segment full of
// `;`, `=` and quotes, so `channel: "plc/+/level"` could never select on it.
// Alias it, and the mappings above read like MQTT topics.
//------------------------------------------------------------------------------
function transportConfig(namespace_index: number): OpcUaTransportConfig {
    const node = (identifier: string): string => `ns=${namespace_index};s=${identifier}`;

    return {
        endpoint_url: ENDPOINT_URL,

        // opc-plc's simulation cycle. Publishing slower than the source changes
        // would just drop samples the server already computed; asking for faster
        // is refused — see `CYCLE_MS`, and the transport logs the refusal.
        publishing_interval: CYCLE_MS,
        sampling_interval: CYCLE_MS,

        nodes: [
            // Four nodes, five parts: the rotor and the tank both read the
            // counter. See `ROTOR_MAPPING`.
            { node_id: node("StepUp"), channel: "plc/counter" },
            { node_id: node("SpikeData"), channel: "plc/piston/stroke" },
            { node_id: node("DipData"), channel: "plc/gauge/pressure" },
            { node_id: node("AlternatingBoolean"), channel: "plc/lamp/state" },
        ],
    };
}

//------------------------------------------------------------------------------
// Ask the server which namespace index it assigned to the opc-plc nodes, instead
// of hardcoding one and leaving the user to work out why nothing arrives.
//
// The index is positional and therefore a property of the running server, but the
// *URI* is stable, and every OPC UA server publishes the mapping between the two
// in a standard node: `ns=0;i=2255`, `Server_NamespaceArray`. Reading it costs one
// short-lived session at startup.
//------------------------------------------------------------------------------
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
        // node-opcua retries a refused connection forever by default, which would
        // turn a pre-flight into a hang. One attempt is all this needs.
        connectionStrategy: { initialDelay: 500, maxDelay: 1_000, maxRetry: 0 },
    });

    try {
        await client.connect(ENDPOINT_URL);
        const session = await client.createSession();
        try {
            // `Server_NamespaceArray`: the standard node every OPC UA server
            // publishes its namespace URIs in, in index order.
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

        // Not transient, so a viewer can find and join this very session.
        is_transient: false,

        // Default mode is "join-or-start": whichever of a viewer and this script
        // comes up first opens the session, and the other one joins it. Set
        // SESSION_ID to pin the agent to a session already open.
        ...(SESSION_ID
            ? {
                  session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) =>
                      sessions.find(s => s.session_id === SESSION_ID) ?? null,
              }
            : {}),

        // The client does not send an entity the moment you write it: it flushes
        // whatever is dirty on a fixed timer, 30 times a second by default. The
        // rate to compare that against is **per entity**, not the total — each
        // part here is driven by one node, so 20 Hz each rather than the 100
        // events a second the five of them add up to.
        //
        // 30 against a 20 Hz part is not the comfortable margin it looks like:
        // two free-running timers that close alias, so some flushes carry two
        // samples (the first overwritten in the dirty entity and never sent),
        // some carry none, and the motion judders although every sample was
        // ingested. At 120 — sixfold headroom, and just under the cap of 125 —
        // every sample gets a flush to itself.
        headless_client: { updatesPerSecond: 120 },
    };
}

//------------------------------------------------------------------------------
async function main(): Promise<void> {
    if (!TOKEN) {
        throw new Error(
            "LIVELINK_TOKEN is not set. Put it in `.env` next to these samples (see `.env.example`) or export it, " +
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

        // A source is started on the first session the agent is ready in, and
        // stopped with the ingestion. A start that fails is reported on
        // "on-error" and retried by the next session to bind — which is the loop
        // that survives the PLC being down when the agent comes up.
        sources: [sink => createTransport({ kind: "opcua", config: transportConfig(namespace_index) }, sink)],
    });

    ingestion.addEventListener("on-error", ({ error }) => console.error("[opcua-agent]", error));
    // Bound, not merely ready: from this event on, ingested samples drive the scene.
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

    // Only report when something moved, so a silent PLC leaves the transport's own
    // reconnection messages legible instead of burying them under empty counters.
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
