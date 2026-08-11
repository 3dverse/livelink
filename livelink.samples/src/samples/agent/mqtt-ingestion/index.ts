//------------------------------------------------------------------------------
// A headless agent that drives a 3dverse scene from a **live MQTT broker**, using
// the data-ingestion layer of `@3dverse/livelink-agent`.
//
//   npm run mqtt
//
// Unlike "OPC UA Ingestion" next door, nothing forces this one into Node: MQTT is
// web-native over WebSocket, so the very same mappings and the very same transport
// run in a page against a `ws://` broker. What changes here is one URL — Node
// speaks the broker's plain TCP `mqtt://` listener directly. `opc.tcp://` has no
// such second form, which is the difference between the two samples.
//
// The data comes from mqtt-sim (https://github.com/marcelo-6/mqtt-sim) driven by
// the `mqtt-sim.toml` shipped next to this file. It publishes two production lines
// of three machine cells, each cell sending motor telemetry at 40 Hz and a
// retained status every few seconds. A broker and the simulator come up together,
// from this directory:
//
//   docker compose -f docker-compose-mosquitto.yml up
//
// Any broker of your own does just as well: point the TOML at it and set
// MQTT_BROKER_URL to its address.
//
// What this sample shows that a recording cannot is **wildcard fan-out**: one
// mapping, six entities, entity identity carried by the routing key. The topic is
// the id, so adding a seventh cell to the TOML adds a seventh machine to the scene
// with nothing to change here.
//
// The session it opens is a normal one, so any viewer pointed at the same scene
// joins it and watches the floor fill up.
//
// Everything is configured through the environment:
//
//   LIVELINK_TOKEN    (required)                the 3dverse access token
//   MQTT_BROKER_URL   mqtt://localhost:1883     the broker to subscribe to
//   MQTT_SITE         livelink-demo             topic prefix; must match the TOML
//   SCENE_ID          the shared samples scene  the scene to drive
//   SESSION_ID        (none)                    pin to a session already open
//------------------------------------------------------------------------------
import { Agent, IngestionPipeline, SceneIngestion } from "@3dverse/livelink-agent";
import type { AgentConfig, ComponentsManifest, EventMapping, SessionInfo } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
import { asNumber, channelSegment, yawQuaternion } from "../lib/ingestion";
import { openSessionInEditor } from "../lib/open-in-editor";

//------------------------------------------------------------------------------
// `npm run mqtt` reads the `.env` beside it if there is one, so the token can
// live in a file next to these scripts or come straight from the shell.
//------------------------------------------------------------------------------
const TOKEN = process.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = process.env.SCENE_ID ?? "48949b83-5acf-49ef-b43a-b180d22e669b";
const SESSION_ID = process.env.SESSION_ID;

// The plain TCP listener of the Mosquitto broker started by
// `docker-compose-mosquitto.yml`. The compose file also exposes a WebSocket
// listener on 8000, which this script has no use for — it is there for a page of
// your own pointed at the same broker, a browser being able to speak MQTT no
// other way.
const BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";

// The topic prefix, which is what keeps this sample's traffic apart from anything
// else on the broker. Must match the TOML.
const SITE = process.env.MQTT_SITE ?? "livelink-demo";

// The same cube mesh and materials the other samples use, so the floor needs
// nothing authored in the scene: this script creates every cell on it.
const MESH_REF = "0577814f-4677-420b-89e8-1e5a4dd56914";

const MATERIAL_REF = {
    light: "5bd5d2c5-65d3-4cdb-adb1-c85ae1502840",
    green: "afbcef75-7c52-4a90-b6e6-d19dcc04c3ad",
    dark: "c9650d73-0f0b-4064-843f-ff0bb8d506e7",
    orange: "78b48c3a-9988-433a-9237-9ea5dc7a57e5",
} as const;

// The `state` values the simulator picks from, and the material each one paints
// the cell with.
const MATERIAL_BY_STATE: Record<string, string> = {
    running: MATERIAL_REF.green,
    idle: MATERIAL_REF.dark,
    fault: MATERIAL_REF.orange,
};

// Turning the shaft at its true speed does not work, at any update rate: 900 rpm
// is 15 revolutions a second, so even a 40 Hz feed advances it 135° per sample and
// a 60 fps frame catches it 90° further along. Past half a turn per sample the
// direction itself is ambiguous — the shaft reads as jittering in place rather
// than spinning. So the cell shows a geared-down shaft, the way a machine display
// does: 900 rpm becomes a legible 15 rpm, and the *number* on the wire stays the
// real one.
const SHAFT_GEAR_RATIO = 60;

//==============================================================================
// Mappings: one per topic family, both spawning the cells they drive.
//==============================================================================

//------------------------------------------------------------------------------
// A cell is identified by the two topic segments before the last:
// `<site>/plant/line-a/2/motor` is cell `line-a-2`. Counting back from the end
// rather than forward from the start keeps this working whatever the site prefix
// is — one segment here, three at a plant that namespaces by region.
//------------------------------------------------------------------------------
function cellId(channel: string): string | null {
    const line = channelSegment(channel, -3);
    const cell = channelSegment(channel, -2);
    return line && cell ? `${line}-${cell}` : null;
}

//------------------------------------------------------------------------------
// Where a cell stands on the floor, derived from its id alone. The stream defines
// the population, so the layout has to be a function of the id rather than a table
// someone maintains: adding a cell to the TOML adds it to the scene.
//------------------------------------------------------------------------------
function cellPosition(id: string, height: number): [number, number, number] {
    const [line, cell] = id.split(/-(?=\d+$)/);
    const row = line.charCodeAt(line.length - 1) - "a".charCodeAt(0);
    const column = Number(cell) - 1;
    return [(column - 1) * 2.5, height / 2, (row - 0.5) * 3];
}

//------------------------------------------------------------------------------
// Motor temperature, as the height of the cell. 20 °C is cold and flat, 95 °C is
// the top of the simulated range.
//------------------------------------------------------------------------------
function cellHeight(temperature: number): number {
    const normalized = Math.max(0, Math.min(1, (temperature - 20) / 75));
    return 0.4 + normalized * 2;
}

//------------------------------------------------------------------------------
// One mapping per topic family. Both are built from the site prefix, because the
// prefix is a deployment decision and `channel` patterns are literal.
//------------------------------------------------------------------------------
function createMappings({ site }: { site: string }): Array<EventMapping> {
    // rpm is a *rate*, and a transform takes an angle: the shaft angle is the
    // integral of the rate over the time between two samples. One accumulator per
    // cell, created with the mappings so restarting the ingestion starts the
    // shafts from zero rather than from wherever they were left.
    const shafts = new Map<string, { angle: number; at: number }>();

    const integrateShaftAngle = (id: string, rpm: number): number => {
        const now = performance.now();
        const shaft = shafts.get(id) ?? { angle: 0, at: now };
        // Clamped: a process that was stalled for a minute must not make the shaft
        // jump a thousand turns on the first sample back.
        const elapsed_seconds = Math.min((now - shaft.at) / 1000, 0.5);
        const angle = shaft.angle + ((rpm * 2 * Math.PI) / 60 / SHAFT_GEAR_RATIO) * elapsed_seconds;
        shafts.set(id, { angle, at: now });
        return angle;
    };

    //--------------------------------------------------------------------------
    const MOTOR_MAPPING: EventMapping = {
        channel: `${site}/plant/+/+/motor`,

        // Validated on the first event by default, so a simulator config that does
        // not carry what the mapping reads is reported instead of silently doing
        // nothing.
        schema: {
            type: "object",
            properties: {
                rpm: { type: "number" },
                temp_c: { type: "number" },
            },
            required: ["rpm", "temp_c"],
        },

        // The stream defines the population: one entity per cell that publishes,
        // created on its first message, deleted when this script disconnects.
        entities: {
            spawn: {
                name: "cell-{id}",
                components: ({ id, event }): ComponentsManifest => {
                    const temperature = asNumber((event.payload as { temp_c?: unknown }).temp_c) ?? 20;
                    const height = cellHeight(temperature);
                    return {
                        debug_name: { value: `cell-${id}` },
                        local_transform: {
                            position: cellPosition(id, height),
                            scale: [1, height, 1],
                        },
                        mesh_ref: { value: MESH_REF },
                        material_ref: { value: MATERIAL_REF.light },
                    };
                },
                options: { delete_on_client_disconnection: true },
            },
        },

        updates: event => {
            const id = cellId(event.channel);
            const payload = event.payload as {
                rpm?: unknown;
                temp_c?: unknown;
            };
            const rpm = asNumber(payload.rpm);
            const temperature = asNumber(payload.temp_c);
            if (id === null || rpm === null || temperature === null) {
                return null;
            }

            const height = cellHeight(temperature);
            return {
                id,
                update: {
                    local_transform: {
                        position: cellPosition(id, height),
                        scale: [1, height, 1],
                        orientation: yawQuaternion(integrateShaftAngle(id, rpm)),
                    },
                },
            };
        },
    };

    //--------------------------------------------------------------------------
    const STATUS_MAPPING: EventMapping = {
        channel: `${site}/plant/+/+/status`,

        // This one addresses entities that already exist, by the name the mapping
        // above spawned them under. The status topics are retained, so on connect
        // the broker replays them all at once — before any motor telemetry has
        // spawned anything. Those resolve to nothing and are counted as
        // `unresolved_entity` in the drops, then resolve on their own as soon as
        // the cells appear.
        entities: {
            byName: "cell-{id}",
        },

        updates: event => {
            const id = cellId(event.channel);
            const material_ref = MATERIAL_BY_STATE[(event.payload as { state: string }).state];
            if (id === null || material_ref === undefined) {
                return null;
            }
            return { id, update: { material_ref: { value: material_ref } } };
        },
    };

    return [MOTOR_MAPPING, STATUS_MAPPING];
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

        // The client flushes dirty entities on a fixed timer, 30 times a second by
        // default. Leave it near the data rate and the two free-running timers
        // alias — some flushes carry two samples, some none, and the motion judders
        // although every sample was ingested. Keep the flush rate above the data
        // rate: 40 Hz per cell here, so 120 is threefold headroom. Capped at 125.
        headless_client: { updatesPerSecond: 120 },
    };
}

//------------------------------------------------------------------------------
async function main(): Promise<void> {
    if (!TOKEN) {
        throw new Error(
            "LIVELINK_TOKEN is not set. Put it in `.env` next to these samples (see `.env.example`) or export it, " +
                "then run `npm run mqtt`.",
        );
    }

    console.log(`[mqtt-agent] Subscribing to ${SITE}/plant/+/+/{motor,status} on ${BROKER_URL}`);

    const ingestion = new SceneIngestion({
        agent: new Agent({ config: agentConfig({ token: TOKEN }) }),
        pipeline: new IngestionPipeline({
            mappings: createMappings({ site: SITE }),
            onError: error => console.error("[mqtt-agent]", error),
        }),

        // A source is started on the first session the agent is ready in, and
        // stopped with the ingestion. A start that fails is reported on "on-error"
        // and retried by the next session to bind — which is the loop that survives
        // the broker being down when the agent comes up.
        //
        // Subscribing to the two families the mappings select on, rather than to
        // `#`, keeps everything else living on the broker off this agent entirely.
        sources: [
            {
                kind: "mqtt",
                config: {
                    broker_url: BROKER_URL,
                    topics: [`${SITE}/plant/+/+/motor`, `${SITE}/plant/+/+/status`],
                },
            },
        ],
    });

    ingestion.addEventListener("on-error", ({ error }) => console.error("[mqtt-agent]", error));
    // Bound, not merely ready: from this event on, ingested samples drive the scene.
    ingestion.addEventListener("on-session-bound", ({ livelink }) => {
        console.log(
            `[mqtt-agent] Driving session ${livelink.session.session_id}. ` +
                `Join it from any viewer on scene ${SCENE_ID} to watch the floor fill up.`,
        );
        void openSessionInEditor({
            scene_id: SCENE_ID,
            session_id: livelink.session.session_id,
            public_token: TOKEN,
        });
    });

    await ingestion.start();

    // Only report when something moved, so a silent broker leaves the transport's
    // own reconnection messages legible instead of burying them under empty
    // counters.
    let last_reported = 0;
    const report = setInterval(() => {
        const stats = ingestion.stats;
        if (!stats || stats.events_received === last_reported) {
            return;
        }
        last_reported = stats.events_received;
        console.log(
            `[mqtt-agent] received ${stats.events_received}  applied ${stats.updates_applied}  ` +
                `written ${stats.components_written}  deduped ${stats.components_deduped}  ` +
                `drops ${JSON.stringify(stats.drops)}`,
        );
    }, 5_000);

    const shutdown = async (): Promise<void> => {
        clearInterval(report);
        console.log("[mqtt-agent] Stopping...");
        await ingestion.stop();
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
}

//------------------------------------------------------------------------------
main().catch(error => {
    console.error("[mqtt-agent]", error);
    process.exit(1);
});
