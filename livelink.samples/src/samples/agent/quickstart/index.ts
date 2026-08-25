//------------------------------------------------------------------------------
import { Agent, IngestionPipeline, SceneIngestion } from "@3dverse/livelink-agent";
import type { EventMapping } from "@3dverse/livelink-agent";

const TOKEN = process.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = process.env.SCENE_ID ?? "8a340516-4eaa-4910-9b0c-8f6948bdf704";

// The UUID of the cube Mesh asset you copied from the Asset Browser.
const CUBE_MESH_ID = process.env.MESH_ID ?? "5cf943bf-c754-4f36-98f6-9c9ea9db8e30";

// An Event Mapping describes how incoming events affect your scene.
// API reference: /references/livelink.agent/type-aliases/EventMapping
const RECORDING = [
    { channel: "devices/dev-01/telemetry", timestamp: "2026-01-01T00:00:00.000Z", payload: { pos: [0, 1, 0] } },
    { channel: "devices/dev-02/telemetry", timestamp: "2026-01-01T00:00:00.000Z", payload: { pos: [2, 1, 0] } },
    { channel: "devices/dev-01/telemetry", timestamp: "2026-01-01T00:00:00.500Z", payload: { pos: [0, 1.5, 0] } },
    { channel: "devices/dev-02/telemetry", timestamp: "2026-01-01T00:00:00.500Z", payload: { pos: [2, 0.5, 0] } },
    { channel: "devices/dev-01/telemetry", timestamp: "2026-01-01T00:00:01.000Z", payload: { pos: [0, 1, 0] } },
    { channel: "devices/dev-02/telemetry", timestamp: "2026-01-01T00:00:01.000Z", payload: { pos: [2, 1, 0] } },
];

const deviceColors: Record<string, [number, number, number]> = {
    "dev-01": [0.8, 0.2, 0.2],
    "dev-02": [0.2, 0.2, 0.8],
};

const telemetryMapping: EventMapping = {
    // Only handle events on this topic pattern. `+` matches one segment.
    channel: "devices/+/telemetry",

    // No entity exists yet: create one per device id, the first time we see it.
    entities: {
        spawn: {
            // The `id` in the entity name comes from the `updates` function below, which extracts it from the event channel.
            name: "device-{id}",
            components: ({ id }) => ({
                local_transform: { position: [0, 0, 0] },
                mesh_ref: { value: CUBE_MESH_ID },
                material: {
                    shaderRef: "a740058e-27a0-48e3-af37-70ae93cc0b67",
                    dataJSON: {
                        albedo: deviceColors[id] ?? [0.8, 0.8, 0.8],
                    },
                },
            }),
            options: { delete_on_client_disconnection: true },
        },
        // The `byUuid` mapping is the alternative to `spawn`. If you have a known set of devices, you can map their ids
        // to the UUIDs of specific existing entities in the scene.
        // byUuid: {
        //     "dev-01": "b2372dc5-961b-4d64-a85e-2ac4e3c6c297",
        //     "dev-02": "015a99a8-57f3-4f24-bf1a-881183cd15fb",
        // },
    },

    // What one event does. The device id comes out of the topic.
    updates: event => {
        const { pos } = event.payload as { pos: [number, number, number] };
        return {
            id: event.channel.split("/")[1],
            update: { local_transform: { position: pos } },
        };
    },
};

const ingestion = new SceneIngestion({
    // The agent attaches to the scene's sessions.
    agent: new Agent({
        config: {
            scene_id: SCENE_ID,
            token: TOKEN!,

            // Join the session you already have open, or start one if there is none.
            mode: "join-or-start",

            // Sessions this agent starts are transient: nothing it writes is persisted,
            // so a public token is enough to drive them.
            is_transient: true,

            // A session costs money for as long as it is open. Leave one minute after
            // the last viewer disconnects, rather than holding it open for nobody.
            leave_on_condition: { after_seconds: 60 },
        },
    }),

    // The engine running your mappings.
    pipeline: new IngestionPipeline({
        mappings: telemetryMapping,
        onError: error => console.error("[mapping]", error),
    }),

    // Where the events come from.
    sources: [{ kind: "playback", config: { source: RECORDING } }],
});

ingestion.addEventListener("on-error", ({ error }) => console.error("[ingestion]", error));
ingestion.addEventListener("on-session-bound", ({ livelink }) =>
    console.log(`Driving session ${livelink.session.session_id}`),
);

await ingestion.start();

process.on("SIGINT", async () => {
    await ingestion.stop();
    process.exit(0);
});
