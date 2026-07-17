# @3dverse/livelink.agent

## About

Headless agent package for controlling 3dverse rendering sessions programmatically (Node.js and browser compatible).

An agent is a headless client that attaches to one or more sessions of a scene and controls them through the entity API: create, update and delete entities, and react to changes made by other clients. Typical use case: bridging an external datasource (MQTT broker, OPC-UA server, WebSocket feed...) to live 3dverse scenes.

## Installation

```bash
npm install @3dverse/livelink-agent
```

## Usage

```typescript
import { Agent } from "@3dverse/livelink-agent";

const agent = new Agent({
  config: {
    scene_id: "your-scene-id",
    token: "your-token",
  },
});

agent.addEventListener("on-session-ready", async event => {
  const entity = await event.livelink.scene.findEntity({ entity_uuid: "..." });
  entity?.updateComponent("local_transform", { position: [0, 1, 0] });
});

await agent.start();
```

By default the agent joins an existing session of the scene, or creates a new one if none exists (`"join-or-start"` mode).

### auto_broadcast

For a smooth real time animation, you want to set `Entity.auto_broadcast` to `false` e.g `entity.auto_broadcast = false` in the upper code snippet before startint to animate the entity. Or, if you create the entity from the agent, you can set it in the options:

```typescript
import { Agent } from "@3dverse/livelink-agent";

const agent = new Agent({
  config: {
    scene_id: "your-scene-id",
    token: "your-token",
  },
});

agent.addEventListener("on-session-ready", async event => {
  const entity = await event.livelink.scene.newEntity({
    name: `Animated object`,
    components: {
      local_transform: "default",
    },
    options: {
      auto_broadcast: false,
      delete_on_client_disconnection: true,
    },
  });
});

await agent.start();
```

## Session modes

The `mode` option of the agent config selects how the agent attaches to sessions:

| Mode                        | Behavior                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `"join-or-start"` (default) | Join an existing session, or create one if none exists.                                                                           |
| `"start"`                   | Always create a new session.                                                                                                      |
| `"join"`                    | Join a single existing session. Fails if none exists, unless `watch` is enabled, in which case the agent idles until one appears. |
| `"join-all"`                | Join all existing sessions of the scene.                                                                                          |
| `"manual"`                  | attach to nothing on start; the agent stays idle and joins sessions on demand through its `join` method.                          |

### Watching for sessions

With the `watch` option (valid in `"join"` and `"join-all"` modes), the agent polls the session list and joins sessions as they appear:

```typescript
const agent = new Agent({
  config: {
    scene_id,
    token,
    mode: "join-all",
    watch: { interval_seconds: 10 },
  },
});
await agent.start();
```

In `"join"` mode, the watch loop only joins a session when the agent is not attached to one (this also serves as a reconnect mechanism after a connection loss).

### Leaving on condition

With the `leave_on_condition` option, the agent leaves any session if a condition is not met for the given duration:

```typescript
const agent = new Agent({
  config: {
    scene_id,
    token,
    mode: "join-all",
    watch: { interval_seconds: 10 },
    leave_on_condition: { after_seconds: 60 },
  },
});
await agent.start();
```

By default, the agent stays while any other client is connected. To make it ignore other agents — so a session occupied only by agents still closes — give it an `agent_roster`: a well-known entity under which each agent registers a marker entity named after its client id (created automatically on join, with `delete_on_client_disconnection`). When `agent_roster_id` is set, the agent stays only while a client without a matching marker (a real viewer) is present, instead of relying on the unreliable `is_headless` flag. If the entity is not found in the scene, an error is logged and the check falls back to plain other-client presence.

```typescript
leave_on_condition: {
    after_seconds: 60,
    agent_roster_id: "d577efd3-cca8-41ca-a58e-27e944f7b5de",
}
```

Customize the decision with the `should_stay` predicate, which receives the session's livelink and the other clients:

```typescript
leave_on_condition: {
    after_seconds: 60,
    should_stay: ({ livelink, other_clients }) => other_clients.some(c => c.client_type === "user"),
}
```

A session left on condition is only rejoined by the watch loop once the condition is met again. A session left deliberately (`agent.leave()` or `agent.stop()`) is never rejoined.

Note: right after joining a session, the client list is populated asynchronously. The leave timer may arm immediately and is simply cleared as soon as the condition is met — with timeouts in seconds this is harmless.

## Lifecycle events

A single `Agent` instance can be attached to several sessions at once, and dispatches its lifecycle events on itself. Each session event carries its `Livelink` directly as `event.livelink`. To keep per-session state, hold your own map keyed by `event.livelink.session.session_id` and clean it up on `on-session-left`.

```typescript
// The agent created this session: seed the scene state.
agent.addEventListener("on-session-created", event => {});

// The agent joined a pre-existing session.
agent.addEventListener("on-session-joined", event => {});

// Always emitted, after on-session-created or on-session-joined.
agent.addEventListener("on-session-ready", event => {});

// The agent left a session. event.reason is "left-on-condition" | "disconnected" | "stopped".
agent.addEventListener("on-session-left", event => console.log("left", event.reason));

// An error occurred (failed join, failed session list poll...). event.livelink is null
// when the error is not tied to an established session.
agent.addEventListener("on-error", event => console.error(event.error));
```

There is no "stopped" event: `agent.stop()` is something you call, so do any post-stop cleanup after `await agent.stop()` returns.

## Wiring a datasource

The package is datasource-agnostic by design: the entity API and the typed events are the integration surface. Wire any messaging system (MQTT, OPC-UA, WebSocket...) yourself:

```typescript
import { Agent, Livelink, EntityUpdatedEvent } from "@3dverse/livelink-agent";
import mqtt from "mqtt"; // or any other client

const agent = new Agent({ config: { scene_id, token } });
const client = mqtt.connect("mqtt://broker.example.com");

async function applyUpdate(livelink: Livelink, entity_uuid: string, position: [number, number, number]) {
  const entity = await livelink.scene.findEntity({ entity_uuid });
  // For smooth animation, do not broadcast the entity's transform to other clients.
  entity.auto_broadcast = false;
  entity?.updateComponent("local_transform", { position });
}

// Inbound: datasource messages -> entity updates, in every attached session.
client.on("message", (topic, payload) => {
  const { entity_uuid, position } = JSON.parse(payload.toString());
  for (const livelink of agent.livelinks) {
    void applyUpdate(livelink, entity_uuid, position);
  }
});
client.subscribe("devices/+/position");

agent.addEventListener("on-session-ready", async event => {
  // Outbound: entity changes made by other clients -> datasource messages.
  const entity = await event.livelink.scene.findEntity({ entity_uuid: "..." });
  entity?.addEventListener("on-entity-updated", (event: EntityUpdatedEvent) => {
    if (event.isExternal()) {
      client.publish("scene/updates", JSON.stringify(entity.local_transform));
    }
  });
});

await agent.start();

// ...later, on shutdown: stop the agent, then close the datasource once it has
// left every session.
await agent.stop();
client.end();
```

Updates made through `updateComponent()` are batched and sent to the server automatically (30 updates/s, persisted once per second by default — tune with the `headless_client` option of the agent config).

## Restarting an agent

`agent.stop()` leaves every session and halts the watch loop, but the agent object stays usable: `agent.start()` attaches a fresh wave using the same config, and listeners added with `agent.addEventListener` survive the cycle. Starting an already-started agent throws.
