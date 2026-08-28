//------------------------------------------------------------------------------
// Headless agent: drives a 3dverse scene from a live MQTT broker.
// Can also run in browser (MQTT over WebSocket).
//
//   npm run mqtt
//   docker compose -f docker-compose-mosquitto.yml up
//
// Demonstrates wildcard fan-out: one mapping drives entities identified by topics.
// Configured via environment: LIVELINK_TOKEN, MQTT_BROKER_URL, SCENE_ID, etc.
//------------------------------------------------------------------------------
import { Agent, IngestionPipeline, SceneIngestion, continuous } from "@3dverse/livelink-agent";
import type { AgentConfig, ComponentsManifest, EventMapping, SessionInfo } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
import { asNumber, channelSegment, yawQuaternion } from "../lib/ingestion";
import { openSessionInEditor } from "../lib/open-in-editor";

//------------------------------------------------------------------------------
// Read from .env or shell environment.
const TOKEN = process.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = process.env.SCENE_ID ?? "48949b83-5acf-49ef-b43a-b180d22e669b";
const SESSION_ID = process.env.SESSION_ID;

// Mosquitto broker (plain TCP listener; WebSocket on 8000 for browsers).
const BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";

// Topic prefix (must match mqtt-sim.toml).
const SITE = process.env.MQTT_SITE ?? "livelink-demo";

// Cube mesh and materials (shared with other samples).
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

// Gear ratio: real 900 rpm shown as 15 rpm (avoids aliasing at 40 Hz).
const SHAFT_GEAR_RATIO = 60;

//==============================================================================
// Mappings: one per topic family, both spawning the cells they drive.
//==============================================================================

//------------------------------------------------------------------------------
// Extract cell ID from topic (count backward to work with any site prefix).
function cellId(channel: string): string | null {
    const line = channelSegment(channel, -3);
    const cell = channelSegment(channel, -2);
    return line && cell ? `${line}-${cell}` : null;
}

//------------------------------------------------------------------------------
// Calculate cell position from ID (stream-driven layout).
function cellPosition(id: string, height: number): [number, number, number] {
    const [line, cell] = id.split(/-(?=\d+$)/);
    const row = line.charCodeAt(line.length - 1) - "a".charCodeAt(0);
    const column = Number(cell) - 1;
    return [(column - 1) * 2.5, height / 2, (row - 0.5) * 3];
}

//------------------------------------------------------------------------------
// Map motor temperature to cell height (20°C flat, 95°C max).
function cellHeight(temperature: number): number {
    const normalized = Math.max(0, Math.min(1, (temperature - 20) / 75));
    return 0.4 + normalized * 2;
}

//------------------------------------------------------------------------------
// Create mappings (built from site prefix for deployment flexibility).
function createMappings({ site }: { site: string }): Array<EventMapping> {
    //--------------------------------------------------------------------------
    const MOTOR_MAPPING: EventMapping = {
        channel: `${site}/plant/+/+/motor`,

        // Schema validated on first event (catches config mismatches).
        schema: {
            type: "object",
            properties: {
                rpm: { type: "number" },
                temp_c: { type: "number" },
            },
            required: ["rpm", "temp_c"],
        },

        // Stream-driven population (spawn on first message, delete on disconnect).
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

            // Temperature is a value: the cell's size is settled here and now.
            const height = cellHeight(temperature);
            const position = cellPosition(id, height);

            // RPM is a *rate*, so the shaft is not set to an angle — it is told a
            // speed. `continuous` keeps it turning between two messages instead of
            // stepping forward only when one arrives, which matters here because the
            // simulator publishes a few times a second and the scene runs at 60.
            const radians_per_second = (rpm * 2 * Math.PI) / 60 / SHAFT_GEAR_RATIO;
            return {
                id,
                update: continuous<{ angle: number }>(
                    ({ delta_seconds, state }) => {
                        // `state` belongs to the cell, not to this motion, so a new
                        // rpm picks the shaft up where it stands.
                        state.angle += radians_per_second * delta_seconds;
                        return {
                            local_transform: {
                                position,
                                scale: [1, height, 1],
                                orientation: yawQuaternion(state.angle),
                            },
                        };
                    },
                    { initial_state: { angle: 0 } },
                ),
            };
        },
    };

    //--------------------------------------------------------------------------
    const STATUS_MAPPING: EventMapping = {
        channel: `${site}/plant/+/+/status`,

        // Address existing entities by name (initially unresolved if replayed before motor events).
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
        // flushes goes out. Each cell here publishes every 25 ms, faster than that
        // default — it would send 3 samples out of every 4. 80 gives each one a
        // flush of its own, with room to spare for a late message.
        headless_client: { updatesPerSecond: 80 },
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

        // Subscribe only to mapping channels (not all topics).
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

    // Only report when stats change (avoid cluttering logs).
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
