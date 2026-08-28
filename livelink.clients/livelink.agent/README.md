# @3dverse/livelink.agent

## About

Headless agent package for controlling 3dverse rendering sessions programmatically (Node.js and browser compatible).

An agent is a headless client that attaches to one or more sessions of a scene and controls them through the entity API: create, update and delete entities, and react to changes made by other clients. Typical use case: bridging an external datasource (MQTT broker, OPC-UA server, WebSocket feed...) to live 3dverse scenes.

See the official documentation: [Connect Live Data](https://docs.3dverse.com/connect-live-data)

## Samples

**Try it**: [Agent Data Ingestion Demo](https://samples.livelink.3dverse.com/#/agent-data-ingestion)

Runnable examples:

- **Node.js agents** (MQTT and OPC UA): [`livelink.samples/src/samples/agent/`](https://github.com/3dverse/livelink/tree/release/livelink.samples/src/samples/agent/README.md) — headless scripts that drive a scene from live infrastructure you start yourself with one docker command. `opcua-ingestion/` drives a machine cell from Microsoft's simulated PLC, [iot-edge-opc-plc](https://github.com/Azure-Samples/iot-edge-opc-plc), and `mqtt-ingestion/` drives a plant floor from a broker fed by [mqtt-sim](https://github.com/marcelo-6/mqtt-sim).
- **Browser samples**: [`x-agent-data-ingestion/`](https://samples.livelink.3dverse.com/#/agent-data-ingestion/) — replays recorded event streams using the `playback` transport, and [`x-agent-multiplayer-game/`](https://samples.livelink.3dverse.com/#/agent-multiplayer-game/) — demonstrates multi-session agent coordination.

## Installation

```bash
npm install @3dverse/livelink-agent
```

## Usage

For the common case — "an external event stream drives entities in the scene" — the package ships an
**opt-in ingestion layer**. Its heavy dependencies (`mqtt`, `@azure/event-hubs`, `node-opcua-client`,
`ajv`) are optional peers, loaded lazily by the transport or validator that needs them; not
installing them is fine, and costs nothing at build or run time.

Two objects. An **`EventMapping`** — a plain object — says how one event type drives entities. An
**`IngestionPipeline`** runs the mappings against every scene bound to it, and `ingest` is how events
get in:

```typescript
import { IngestionPipeline, type EventMapping } from "@3dverse/livelink-agent";

const mapping: EventMapping = {
  // Optional selectors: an MQTT-style pattern over the event's channel, and/or a payload predicate.
  channel: "devices/+/telemetry",
  // Optional JSON Schema: the FIRST matching event is validated against it (every event with the
  // pipeline's `validate: true` — a debugging tool).
  schema: { type: "object", properties: { pos: { type: "array" } }, required: ["pos"] },
  // Which scene entities the ids these events carry address — one of four strategies, detailed below.
  entities: {
    spawn: {
      name: "device-{id}",
      components: { local_transform: { position: [0, 0, 0] } },
      options: { delete_on_client_disconnection: true },
    },
  },
  // What one event does. Return one `{ id, update }`, an array of them when a single event carries
  // several objects, or null to ignore the event. `update` is a set of component patches,
  // "delete" / "hide" / "show" to act on the entity as a whole, or `continuous(...)` for
  // something that keeps moving between events (see below).
  updates: event => ({
    id: event.channel.split("/")[1], // the id can come from the channel, the payload, anywhere
    update: { local_transform: { position: (event.payload as { pos: [number, number, number] }).pos } },
  }),
};

const pipeline = new IngestionPipeline({ mappings: mapping }); // or an array
pipeline.bind({ scene });
await pipeline.ingest({ channel: "devices/42/telemetry", payload: { pos: [1, 2, 3] } });
```

Nothing above needs an agent, a session or a broker — which is what makes a mapping straightforward
to unit-test, to drive from a webhook or a REST handler, and to replay one frame at a time.

### Updates that keep going

Some events carry a **rate**, not a value — "the shaft is turning at 90 rpm". A rate still means
something after the message that delivered it, so writing a finished patch would leave the entity
frozen until the next message, which for a machine reporting only on change may be minutes away.

Wrap the update in `continuous()` and it keeps producing values until a later event for that id
replaces it:

```typescript
updates: event => {
  const { rpm } = event.payload as { rpm: number };
  const id = event.channel.split("/")[1];

  return {
    id,
    update: continuous<{ angle_deg: number }>(
      ({ delta_seconds, state }) => {
        // 360 degrees a turn, 60 seconds a minute.
        state.angle_deg = (state.angle_deg + rpm * 6 * delta_seconds) % 360;
        return {
          local_transform: {
            eulerOrientation: [state.angle_deg, 0, 0]
          }
        };
      },
      { initial_state: { angle_deg: 0 } },
    ),
  };
},
```

The sample is handed three things:

|                 |                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------- |
| `delta_seconds` | Since the previous sample, `0` on the installing event. For a value that **accumulates**. |
| `since_seconds` | Since this motion started. For a value that is a closed form of its age — a fade, a ramp. |
| `state`         | Scratch space belonging to the **entity**, not to this motion.                            |

`state` survives the event that replaces the continuation, so a new rpm picks the shaft up where it
stands rather than snapping it back; `initial_state` therefore applies only the first time an entity is
given one.

A motion is installed per `(mapping, id)` — not per channel, and not per session, so two sessions on the
same scene turn the same shaft at the same speed. It runs until one of five things happens: the sample
returns `null`, it throws, a later event for that id replaces it, it or an event produces `"hide"` or
`"delete"`, or you call `pipeline.clearContinuations()`.

Nothing expires a motion on a timer, so a stream that dies leaves the scene moving: watch
`last_event_at` against `continuations_active` (below) for that, and `SceneIngestion` calls
`clearContinuations()` when it stops its sources.

> **`updates` returning `null` does not stop a motion.** It means the message said nothing about that
> entity, which is what lets one topic carry payloads of several shapes. To stop a motion from an event,
> return `continuous(() => null)`. A plain component patch does not stop one either — patch and motion
> are independent writes, so on a shared component the tick wins.

`SceneIngestion` runs the clock (`ticksPerSecond`, twice the client's flush rate by default, `0` to
switch it off), redundant writes are still deduplicated so an entity holding still costs nothing, and
ticks are **not** counted as events. Driving the pipeline yourself, `pipeline.tick(elapsed_seconds)` owns
no timer, so a motion replays exactly from a test:
`await pipeline.ingest(event); await pipeline.tick(0.5);`.

### Addressing entities: the four strategies

| Strategy                                               | How the id finds its entity                                                                                                                      | Linkage                                              | Typical use                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `byName: "{id}"` (string or `({id, event}) => string`) | Looks up an entity **already in the scene** by name (`{id}` substituted, or computed)                                                            | Optional                                             | The scene is already named after the stream's ids — no UUID configuration needed |
| `byUuid: { "servo-01": "<uuid>" }`                     | A fixed, closed id → UUID table, looked up in the scene                                                                                          | Optional (per entry, via `{ entity_uuid, linkage }`) | A small, known population (e.g. named parts of one machine)                      |
| `resolve: ({ id, event }) => ...`                      | An arbitrary function returning a UUID, `{ entity_uuid, linkage }`, or `null` — still resolves an **existing** entity, just computed dynamically | Optional                                             | An external lookup service, or a naming convention with exceptions               |
| `spawn: { name, components, options }`                 | No pre-existing entity — one is **created** per new id, from a template, the first time that id is seen                                          | Not accepted — always created at the scene root      | New objects arriving over the stream (a device joining a fleet)                  |

The four are mutually exclusive — set exactly one per mapping (enforced by TypeScript's discriminated
union; a mapping setting none throws at construction). Resolution is cached per id per scene: once an
id resolves (or fails to), later events for that id reuse the result instead of re-running the
strategy. A cached failure is retried automatically when the scene's own
`on-entities-created`/`on-entities-deleted` events suggest the answer changed. `spawn` follows the
same cache: the entity it creates is reused on every later event for that id, and only a fresh `spawn`
happens after that entity is gone (deleted by this mapping's `"delete"` directive, or by another
client) and a further event arrives for the same id. An id that resolves to nothing surfaces as
`unresolved_entity` in `ingestion.stats.drops` (below).

### Binding it to the sessions of an agent

`SceneIngestion` is the wiring: it binds each ready session's scene to the pipeline, unbinds it when
the session goes, and starts the data sources on the first binding.

```typescript
import { Agent, SceneIngestion } from "@3dverse/livelink-agent";

const ingestion = new SceneIngestion({
  agent: new Agent({ config: { scene_id, token } }),
  pipeline, // always yours to build — see above
  sources: [{ kind: "mqtt", config: { broker_url, topics: ["devices/#"] } }],
});

ingestion.addEventListener("on-error", ({ error }) => report(error));

await ingestion.start();
// ...events flow. You can push your own in at any time:
await ingestion.ingest({ channel: "devices/42/telemetry", payload });
await ingestion.stop();
```

Errors split by layer: the **pipeline**'s `onError` reports a mapping that throws or an entity write
that fails; the **ingestion**'s `on-error` event reports a source that fails to start or an underlying
agent error. Point both at the same handler for a single channel. An `on-error` nobody listens for
falls back to the console rather than vanishing.

`sources` is optional, and `SceneIngestion` is itself an `EventSink` — so a transport you own can be
pointed straight at it, and events from anywhere else can be pushed in with `ingest`.

Sources start **lazily, on the first ready session**, and are shared by every session. Until a
session is ready nothing is subscribed; anything ingested with no scene bound is counted as a
`no_binding` drop rather than lost silently.

### Knowing whether data is flowing

```typescript
const { events_received, updates_applied, components_written, drops, last_event_at } = ingestion.stats!;
```

`drops` breaks down by reason — `no_binding`, `no_mapping_matched`, `schema`, `no_id`, `no_updates`,
`unresolved_entity` — which is what separates "the stream isn't arriving" from "it arrives but no
mapping wants it" during bring-up. `per_mapping` carries the same counters mapping by mapping, plus
`continuations_active`: with several mappings, that is what says which one is still driving something
after its stream went quiet.

Counting is on by default: it allocates nothing and costs a few integer increments per event, well
under a single component write. For the very highest-frequency streams, build the pipeline with
`stats: false` — `stats` then reports `null` rather than zeros, so a disabled counter can never be
misread as "nothing flowed".

`SceneIngestion` also emits `on-running`, `on-session-bound` /
`on-session-unbound`, `on-error`, and re-emits the agent's own session events, so you never have to
reach through `.agent` to observe it.

### Transports

The bundled transports are `mqtt`, `opcua`, `azure-event-hub` and `playback`. **Note that `channel`
only means something on some of them**: it is the topic on MQTT, the node id — or its alias — on OPC
UA, the recorded topic on playback, and the _partition id_ — a load-balancing artifact — on Azure
Event Hubs, where you should select on the payload with `when` instead. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture.

`opcua` subscribes to variables on an OPC UA server over `opc.tcp://` — the classic client/server
profile a PLC exposes — and publishes each value change as `{ node_id, value, status }`. Raw node ids
make unreadable channels, so alias them:

```typescript
sources: [
  {
    kind: "opcua",
    config: {
      endpoint_url: "opc.tcp://plc.example.com:4840",
      nodes: [{ node_id: 'ns=3;s="DB_Line1"."Temperature"', channel: "plc/line1/temperature" }],
      publishing_interval: 500,
      security_mode: "SignAndEncrypt", // implies Basic256Sha256; omit for an unsecured endpoint
      username: "operator",
      password: process.env.PLC_PASSWORD,
    },
  },
];
```

Node.js only, `opc.tcp` being raw TCP. Samples whose status is Bad carry no meaningful value and are
dropped rather than written into the scene, logging once per node instead of at every publication.
The intervals are a _request_ — the server answers with the pace it will hold to, and most refuse to
publish faster than 50 ms — so a request revised upward is logged once too, rather than leaving a
scene moving at half the configured rate with nothing to say why.
A secured connection makes node-opcua generate a self-signed client certificate on first use, which
the server has to be told to trust — on a Siemens PLC that is a manual step in its web interface,
and the failure everyone hits first.

**If the plant already bridges OPC UA to MQTT** — OPC UA PubSub over MQTT on recent firmware,
Telegraf's `inputs.opcua`, Kepware, Ignition — point `mqtt` at that broker instead: one hop fewer,
and no OPC UA session to keep alive next to the scene. `opcua` is for the servers that offer no such
bridge.

`playback` replays a recorded event stream from wherever it lives — a file, a URL, a string, bytes,
a stream, or records you parsed yourself — so the same mapping can be brought up against a dump
before it ever meets a broker, in Node or in the browser:

```typescript
sources: [{ kind: "playback", config: { source: { url: "/recordings/devices.json" }, speed: 2 } }];
```

Only `source: { file_path }` needs Node. `speed` scales the recorded pace (default `1`, real time)
and `loop` (default `true`) starts the recording over when it ends. The former `file` kind is a
deprecated alias.

For runnable examples, see the [Samples](#samples) section above.

Need the raw `Agent` API instead — no ingestion layer? See
[Using the agent directly](#using-the-agent-directly).

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

Note that a `Client` seen by an agent has **identity only** — `id`, `user_id`, `username`, `client_type`, `is_external`. What a client shows (the camera entities it views the scene through, the entity under its mouse pointer) travels in the client metadata piggybacked on the video frames, which an agent never receives; those members live on the browser SDK's `Client`. To reach a viewer's own entities from an agent, have the viewer publish what it wants the agent to know into the scene, or key the state you keep on `client.id`.

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

Note that `on-session-ready` does **not** mean every entity of the scene is addressable: a scene pulling others in through `scene_ref` components is streamed in progressively, and entities living in those referenced scenes do not exist server-side until the server says it is done. `await livelink.scene.waitForSceneLoaded()` before looking one up — the ingestion layer above already does it for you, before resolving anything. It resolves `true` once the scenes are loaded and `false` if the session disconnected first, and never throws. Note that it has **no timeout**: a scene whose reference the token cannot read never finishes loading, and the wait then only ends on disconnection, so race it against a deadline of your own if you cannot afford to be parked.

## Using the agent directly

This section covers the `Agent` API directly, without the ingestion layer above — reach for it when a
mapping doesn't fit, or you already have an ingestion layer of your own.

### Basic usage

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

For a smooth real time animation, you want to set `Entity.auto_broadcast` to `false` e.g `entity.auto_broadcast = false` in the upper code snippet before starting to animate the entity. Or, if you create the entity from the agent, you can set it in the options:

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

The ingestion layer's `IngestionPipeline` already does this automatically for every entity it resolves
or spawns (`manage_auto_broadcast: true` by default) — set `manage_auto_broadcast: false` on the
pipeline to manage it yourself instead.

### Wiring a datasource by hand

The ingestion layer above is the shortest path. Underneath it, the package stays datasource-agnostic:
the entity API and the typed events are the integration surface, and you can wire any messaging
system (MQTT, a WebSocket feed, a serial bus...) against a raw agent yourself:

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
