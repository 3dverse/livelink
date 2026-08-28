# Architecture — `@3dverse/livelink-agent`

The package has two conceptual layers, both reachable from the single entry point
`@3dverse/livelink-agent`:

- the **Agent core** (`sources/`) — attach policy, lifecycle, headless `Livelink`;
- the **data module** (`sources/data/`) — an opt-in ingestion layer.

The **Agent core** is datasource-agnostic: it attaches to sessions and hands you the entity API and
typed lifecycle events. That is all some integrations need — wire your own datasource against it
(see the "Wiring a datasource" section of the README).

The **data module** covers the recurring case of "an external event stream drives entities in the
scene". It is re-exported from the same entry, but its heavy dependencies (`mqtt`,
`@azure/event-hubs`, `node-opcua-client`, `ajv`) are declared **optional** and imported **lazily**, so they are never
_loaded_ unless you actually use the matching transport or schema validation. A consumer that has
not installed them still builds: bundlers leave an unresolvable dynamic import alone (Vite emits an
empty stub chunk). Where they _are_ installed, a bundler emits them as separate chunks — fetched
only if the code path runs. (One entry = one bundle = one core: an earlier `/data` subpath split was
collapsed to avoid a duplicated-core hazard when a consumer used both entries.)

Optional at runtime is not the same as absent at development time: all four — `mqtt`,
`@azure/event-hubs`, `ajv` and `node-opcua-client` — are also devDependencies, so `tsc` checks the
calls against their real types and a signature change upstream fails the build rather than a live
connection. `transports/OpcUaClientModule.ts` names those types (`import type`, erased at compile
time, so nothing static is added to the bundle) alongside the OPC UA specification constants, which
stay spelled out because they read more cheaply than the enum lookups they replace.

`node-opcua-client` is ~90 Node-only packages, which is why it was for a while **declared rather
than installed** — an ambient `declare module` plus a hand-written structural view of the six methods
`OpcUaTransport` calls. That traded the compiler's ability to notice upstream drift for an install
cost, and it was retired once the install cost was paid: the transport's tests run against a fake
that would keep passing through any such drift, so the type check was the only thing standing behind
those six calls.

The reason it could not simply be installed before is worth keeping in mind, because it is a
property of npm workspaces rather than of this package: a workspace member's devDependencies hoist
to the root `node_modules`, where `livelink.samples` — the one browser-bundled consumer of this SDK
— resolves them, and npm has no per-workspace opt-out. The transport reaches its peer through a
statically analysable `import("node-opcua-client")`, so a bundler that _can_ resolve the specifier
will pull the whole Node-only tree into a browser bundle. That is now prevented at the single place
it can happen: `livelink.samples/vite.config.ts` excludes the specifier from both the dev-server
prebundle and the production build, restoring exactly the behavior of a consumer who never installed
it. The two payload projections (`OpcUaVariant` / `OpcUaDataValue`) stay narrow structural types so a
test sample can be a plain object literal; `opcua-transport.test.ts` pins them field by field against
the real `Variant` / `DataValue` so the narrowing cannot drift.

---

## The concepts

An integration answers three questions. The engine that answers the middle one is a standalone
object, and the one that answers the third is thin wiring:

| Question                          | Concept                                  | Options                                                                                   |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Where do events come from?        | **Transport** (a source)                 | `playback`, `mqtt`, `azure-event-hub`, `opcua`, your own — or nothing, and push events in |
| How does an event drive entities? | **EventMapping** → **IngestionPipeline** | a plain object: selection + `entities` + `updates`                                        |
| Which scene(s)/session(s)?        | **Agent** + **SceneIngestion**           | the `Agent`'s mode: one session (`join-or-start`) … all sessions (`join-all` + watch)     |

```typescript
import { Agent, SceneIngestion, type EventMapping } from "@3dverse/livelink-agent";

// ONE plain object describes how an event type drives entities: two fields do the work.
const mapping: EventMapping = {
  channel: "uagv/+/+/+/visualization", // MQTT-style pattern over the event's channel
  schema: agvEventSchema, // optional: the FIRST matching event is validated
  // Which scene entities the ids carried by those events address:
  entities: { spawn: { name: "AGV-{id}", components: { scene_ref: { value: SCENE } } } },
  //  or: { byName: "{id}" } / { byUuid: {...} } / { resolve: fn } for entities already there
  updates: event => ({
    id: event.channel.split("/")[3], // the serial number, from the topic
    update: { local_transform: agvPoseToTransform(event.payload.agvPosition) },
  }),
};

const ingestion = new SceneIngestion({
  agent: new Agent({ config: { scene_id, token, mode: "join-all" } }),
  pipeline: new IngestionPipeline({ mappings: mapping, onError }), // or an array of mappings
  sources: [{ kind: "mqtt", config: { broker_url, topics } }],
});
await ingestion.start();
```

## `ingest` is the entry point

The pipeline is a plain object you can hold, bind scenes to, and **push events into**. Transports
are one way to feed it, not the only way:

```typescript
const pipeline = new IngestionPipeline({ mappings });
pipeline.bind({ scene });
await pipeline.ingest({ channel: "uagv/v2/m/AGV-1/visualization", payload });
```

That is what makes a mapping testable without a broker, drivable from a webhook or a REST handler,
and replayable one frame at a time from a debug control. `SceneIngestion` exposes the same
`ingest`, and **is** an `EventSink` — so any transport, bundled or yours, can be pointed straight at
it, and you can add your own sources alongside the configured ones.

## One event's journey

```
 external source                         data module                          3dverse scene
 ───────────────   ┌──────────────────────────────────────────────────────┐   ─────────────
  MQTT / Event  ─► │ Transport                                            │
  Hub / replay  ─► │     │                                                │
  or your code  ─► │     │  ingest(IngestEvent) — or your own call        │
                   │     ▼                                                │
                   │  for each EventMapping whose channel / when match:   │
                   │    1. validate?   (first event; all with `validate`) │
                   │    2. updates(event) → { id, update }, or an array   │   (once per mapping)
                   │     │                                                │
                   │     ▼   fan out over every bound scene               │
                   │    3. resolve   id → entity  ────────────────────────►   scene.findEntity / findEntitiesByNames / newEntity
                   │    4. apply     (skipping redundant writes)          │
                   │     │                                                │
                   │     ▼                                                │
                   │  entity.updateComponent(...)  ───────────────────────►   (broadcast by the agent update loop)
                   │  or delete / hide / show                             │
                   │                                                      │
                   │  tick(dt) ─► re-sample the continuous updates ──► 3. │   (no event involved; not counted as one)
                   └──────────────────────────────────────────────────────┘
```

`IngestionPipeline` runs steps 1–4 against every scene bound to it. `SceneIngestion` is the wiring
around it: it binds a scene on `on-session-ready`, unbinds it on `on-session-left` (so a
dropped-then-rejoined session rebinds automatically), starts the shared sources on the first
binding, and re-emits the agent's lifecycle events so one object is enough to observe the whole
thing. Multi-session is the general case; a single shared session (`mode: "join-or-start"`) is
simply N = 1. It **receives** its `Agent` (never constructs one — hence the `import type` in its
source): the attachment policy stays yours.

## `channel` means different things per transport

The channel is the only routing dimension that comes from the event envelope rather than its body,
and it is **only meaningful on some transports**. Know which before writing a `channel` selector:

| Transport         | `channel` is                               | Usable in a `channel` pattern                |
| ----------------- | ------------------------------------------ | -------------------------------------------- |
| `mqtt`            | the topic                                  | **yes** — a genuine routing key              |
| `opcua`           | the node's `channel` alias, else its id    | **yes**, and worth aliasing (see below)      |
| `playback`        | the recorded topic, else `default_channel` | **yes**, when the recording carries channels |
| `azure-event-hub` | the partition id                           | **no** — a load-balancing artifact           |

Event Hubs has no per-message routing key: the same logical device can land on any partition, and
the assignment can change. Select on the payload with `when` there. The partition id, offset and
sequence number are still carried in the event's `metadata`.

OPC UA has the opposite problem: its routing key is real but unreadable. A node id is one opaque
segment full of `;`, `=` and quotes, and patterns match over `/`-separated segments — so aliasing
`ns=3;s="DB1"."Temp"` to `plc/line1/temperature` in the node's spec is what makes a `channel`
selector worth writing at all.

Playback preserves what was recorded: an MQTT dump (`<topic> <json>` lines) replays on its
original topics, and a JSON recording of `{ channel, payload, timestamp }` envelopes replays on
theirs — so **the same mapping behaves identically live and replayed**, which is the point of
replaying at all. Only a bare-payload recording, which carries no channel information, falls back to
a constant. Narrow a dump with `channel_filter` rather than pre-filtering the recording.

## Playback is a source, not a file

`PlaybackTransport` replays a _dump of an event stream_. Where those bytes live is incidental, so
`source` accepts a file path (`{ file_path }`, Node only), a URL (`{ url }`, `fetch`, so browser and
Node), the dump itself as a string or bytes, a `ReadableStream` or async iterable, records the caller
already parsed, or a `() => source` factory. Only the `{ file_path }` form touches Node's file
system — which is what lets the same transport drive a server-side replay and a browser demo
(`livelink.samples`' _Data Ingestion_ sample feeds it a bundled string).

It **buffers the whole recording before replaying**: looping needs every message in memory, and
pacing needs the first timestamp before the second message can be scheduled. It is a replayer, not a
reader of live streams — for a live source, write a `Transport` that pushes as it reads. `speed`
scales the recorded pace, `loop` (on by default) starts over at the end.

`"file"` remains registered as a deprecated alias of `"playback"` that maps `{ file_path, ... }` onto
the new config and keeps the old `"file"` default channel.

## EventMapping: one event type each

An `EventMapping` describes **one event type**. Sources carrying several event types — the MQTT
norm, e.g. VDA 5050's `connection` / `state` / `visualization` topic families — use **several
mappings**; each event is handled by every mapping whose selectors match:

- `channel: "uagv/+/visualization"` — MQTT-style pattern over the event channel (`+`/`*` one
  segment, trailing `#` the rest);
- `when: event => ...` — payload-content predicate.

What the events then do is **one field**, `updates`, a function of the whole event returning
`{ id, update }` entries:

- **one entry** when an event is about a single object — the id may come from the payload, the
  channel, the metadata, or several fields combined, because the function sees all of it;
- **an array** when one event carries the state of several objects at once, the norm for a machine
  publishing a whole-state frame;
- **`null`** (or an empty array) to ignore the event.

There is deliberately no second, declarative form. An earlier revision split this into a
`targetId` + `updates` pair beside a multi-target `targets`, three fields whose mutual exclusivity
only a runtime throw could express; the pair only existed to support a dot-path string id
(`"serialNumber"`), which every real consumer bypassed with a function anyway.

`entities` declares what those ids address — four sibling strategies, one question ("how does this id
find its entity?"): `byName` (the entity whose _name_ the id produces, so a scene named after the
stream's ids needs no UUID configuration at all), `byUuid` (a fixed id → UUID table), `resolve` (an
arbitrary function), and `spawn` (no pre-existing entity — one is created per new id, from a
template). The first three accept a `linkage`; `spawn` creates at the scene root and does not.

Each entry's `update` is component patches, a whole-entity directive — `"delete"`, `"hide"`, `"show"`,
for events that change whether the entity is there at all (a device leaving the fleet, a part going
out of service) — or a **`ContinuousUpdate`**, below.

## An update that keeps going

Some events carry a **rate**, not a value: "the shaft is turning at 90 rpm". A rate still means
something after the message that delivered it, so a mapping returning a finished patch would leave
the entity frozen until the next one — and a machine reporting only on change may not send another
for minutes. `continuous(fn)` instead says what the entity is _doing_, and the pipeline re-samples it
until a later event for that id replaces it:

```typescript
updates: event => ({ id, update: continuous(({ delta_seconds, state }) => ({ local_transform: { ... } })) });
```

The decisions worth recording:

**It is tagged, not merely function-shaped.** Treating any function-valued `update` as a continuation
is cheaper and has one fatal property: `update: () => buildPatch(payload)` is a plausible slip, is
perfectly well-typed, and would silently install a motion that never stops. The tag turns that into an
error message naming the fix. It is not a lock, and does not try to be — `Symbol.for` is reachable by
string, and a hand-built object is a supported alternative to `continuous()`.

**Continuations live on the mapping, keyed by `(mapping, id)`.** `updates(event)` runs once and fans
out to every bound scene, so a continuation must be sampled once per tick and fan out the same way. On
a `BindingState` slot it would advance a _stateful_ closure once per session — two sessions, and the
shaft turns at double speed. Not per channel either: one mapping matching `plant/+/telemetry` holds
`plc01` and `plc02` in the same map.

**`state` belongs to the entity, not to the motion.** A rate needs a phase to accumulate into, and that
phase must survive the event that replaces the continuation — a new rpm picks the shaft up where it
stands. So `CompiledMapping.states` is keyed by id and outlives the continuations reading it, going
only when the entity does (`"delete"`); `initial_state` therefore applies **only** to an id with no
state yet. Left to the mapping, this is a `Map` read at event time and written back on every tick —
three lines that are one misplaced read away from accelerating forever.

**`tick(elapsed_seconds)` owns no timer**, and `since_seconds` accumulates from the ticks rather than
the wall clock. Time enters through exactly one argument, so replaying the same ticks replays the same
motion and a moving scene is testable with no fake timers:

```typescript
await pipeline.ingest(event); // "turning at 90 rpm"
await pipeline.tick(0.5); // half a second later, wherever that puts it
```

`SceneIngestion` owns the interval (`ticksPerSecond`, `0` to switch it off), started on the first ready
session and stopped when the last one leaves. The default is **twice** the client's `updatesPerSecond`
(60 when none is declared): the two timers free-run and beat against each other, so ticking at exactly
the flush rate lets a sample's age at flush time wander across a whole window and the motion jitters;
twice as often bounds that to half a window. The rate goes through the same `computeIntervalInMs` guard
as `updatesPerSecond`, so `NaN` — what `Number(process.env.X)` yields for a bad value, and what
`setInterval` turns into a busy loop — cannot reach a timer. Three properties a bare `setInterval` over
`Date.now()` would not have:

- **monotonic** (`performance.now()`) — an NTP step backwards would hand every motion a negative
  elapsed time and rewind the scene;
- **bounded** (0.5 s per tick) — a process back from suspension has minutes of wall clock to account
  for, and handing that to a motion teleports it. The time is dropped on purpose;
- **non-overlapping** (an in-flight promise) — two overlapping ticks can apply out of order, which also
  poisons `ComponentPatchApplier`'s dedup memory and leaves the entity stuck on the stale value. Skipped
  time is folded into the next tick, so a motion does not run slow under load.

`SceneIngestion.ingest` also **settles the clock before an event reaches the pipeline**: without it the
slice between the last tick and the event is credited to whatever the event installs, at its new rate
rather than the one actually in force. Total time is conserved either way, so it is a misattribution
rather than a drift — but a changing rate pays it once per event and the phase leads persistently. That
is the one layer owning both the clock and the events; `IngestionPipeline` stays a pure function of the
ticks it is handed.

**A tick is not an event.** It leaves `events_received`, `events_matched` and `last_event_at` alone, so
those keep answering "is data still arriving?" while the scene moves under its own steam — the one
diagnostic a 30 Hz clock would otherwise destroy. Ticks get `ticks_processed` and a
`continuations_active` gauge, global and per mapping; `components_written` does include clock-driven
writes, because they are writes.

**Five ways a motion ends**, and only five: the sample returns `null`; it throws (it would throw again
on every tick); a newer event for the same id replaces it; it — or an event — produces `"hide"` or
`"delete"`, since nothing visible is moving; or `clearContinuations()` is called, which `SceneIngestion`
does when it stops its sources. `"delete"` drops the entity's state with it, `"hide"` keeps it.

**Nothing expires a motion on a timer, deliberately.** An earlier revision had `max_seconds` and warned
past a minute unrefreshed; both are gone. What they could measure was time since an event _replaced_ the
motion, which is not "the stream died" — one topic may carry payloads of several shapes, so a healthy
stream refreshes nothing while the mapping returns `null` for the messages without a rate. The honest
signal was already there and costs nothing: `last_event_at` against `continuations_active`, the two
disagreeing being the picture outliving the data, and `clearContinuations()` the switch for acting on it.

**Two things that look like a stop and are not.** `updates` returning `null` returns before
continuations are touched, so it means "this message said nothing about this entity" — which is what
makes the mixed-payload topic work; `continuous(() => null)` is how an event stops a motion. And a plain
component patch for the same id does not stop one either: patch and motion are independent writes, and
on a shared component the tick wins. Both are documented rather than changed, the alternative being that
you cannot set an unrelated component on a moving entity.

**Failing to resolve is not on that list.** Resolution runs once per bound scene against a map shared by
all of them, so uninstalling from there would stop the motion in every other scene — and at bring-up,
where the entity is not in the scene yet, it would stop the motion inside the very `ingest()` that
installed it. So an unresolved id costs a cached lookup per tick, and starts moving by itself once the
scene's own `on-entities-created` drops the cached miss. That fallback is the only reason a continuation
retains its installing event: resolution takes one and a tick has none, which also makes the event a
`byName` or `resolve` function sees on a tick deliberately stale — it is the message that said which
entity this motion is about. Tick-time misses are not counted in `drops`, which stays an event-level
story rather than a 30 Hz one.

Internally, each bound scene gets its own resolver per mapping — resolvers cache id → entity
resolutions against that scene (single in-flight production, warn-once on unresolvable ids).

## Validation, performance & cache invalidation

- **Schema**: when a mapping declares one, the **first matching event** is validated against it — a
  cheap sanity check that the stream has the expected shape. `validate: true` extends this to every
  event (a debugging tool; don't pay per-event validation in production). `ajv` is imported lazily,
  only when a schema is actually used.
- **Write dedup**: the applier remembers the last patch per (entity, component) and skips
  deep-equal writes, so a stream repeating values does not churn the update loop.
- **Resolution cache**: id → entity is resolved once per scene, then served from cache — including
  failures, so an id that maps to nothing is looked up once instead of on every event. The cache
  **largely invalidates itself from the scene's own events**: `on-entities-created` retries the ids
  that resolved to nothing, but only when one of the entities that just appeared carries the name (or
  UUID) that id was looking for — an unnarrowed retry would cost a round trip per unresolved id per
  spawn on a scene with a spawning mapping in it. `on-entities-deleted` drops the resolutions
  pointing at what another client deleted.

  The one case the scene cannot announce is a deletion **this** client performed: `Scene.deleteEntities`
  empties its entity registry and dispatches nothing, and the server's echo then matches no registered
  entity. So the pipeline calls `resolver.forget(id)` itself after a `"delete"` directive — without
  it, the id would stay bound to a dead entity forever and never respawn. Nothing else needs a manual
  invalidation.

- Ordering caveat: during an entity's creation window, two rapid events for one id may apply out of
  order. Updates functions are synchronous, which keeps steady-state ordering stable.

### The flush rate has to outpace the stream

An applied write is not a sent write. `updateComponent` only flags the entity dirty; the client
flushes whatever is dirty on a fixed timer — `headless_client.updatesPerSecond`, **30 by default**
(capped at 125, an 8 ms interval). A stream arriving at the same rate as that timer is the bad case:
the two free-running timers alias, so some flushes carry two samples — the first is overwritten in
the dirty entity and never leaves the process — and some carry none. Every event is ingested,
`components_written` counts them all, and the motion still judders.

Nothing in the counters can show this, because from the pipeline's side nothing went wrong. Size the
flush rate off the data rate, not the other way round: keep it comfortably above, and each sample
gets its own flush.

## Observability

`pipeline.stats` (also `ingestion.stats`) answers "is data actually flowing?", which neither the
transport nor the scene can:

```typescript
const { events_received, updates_applied, components_written, drops, last_event_at } = ingestion.stats!;
```

Counters cover events in, updates out, component writes and dedups, per-mapping breakdowns, and
**why** anything was dropped: `no_binding` (no scene bound yet), `no_mapping_matched`, `schema`,
`no_id`, `no_updates`, `unresolved_entity`. Those first two are the ones that matter during
bring-up — they separate "the stream is not arriving", "it arrives but nothing is listening yet"
and "it arrives but no mapping wants it", three failures that otherwise look identical from outside.
Note that `events_matched` and `events_dropped` overlap: an event a mapping selected but applied
nothing for counts in both — and every way of getting there has a reason attached, including an event
whose entries were all motions already over on their first sample (`no_updates`). An `events_dropped`
with nothing in `drops` would read as the pipeline losing events, which is the wrong thing to be
debugging.

Counting is **on by default**. The counting path allocates nothing — timestamps are held as epoch
milliseconds and only become `Date`s in a snapshot — so it costs a handful of integer increments per
event, far below the deep-equal + clone a single component write already pays. `stats: false` on the
pipeline swaps in a no-op collector for the very highest-frequency streams; `stats` then reports
`null` rather than zeros, which would read as "nothing flowed".

Below the counters, transports log what no counter can express — a node reporting a bad status, a
server revising the subscription intervals it was asked for — on the console, prefixed with the
transport kind and emitted once per condition rather than once per publication.

`SceneIngestion` is a `TypedEventTarget`: `on-running`, `on-session-bound` / `on-session-unbound`,
`on-error`, plus the agent's own `on-session-created` / `-joined` / `-ready` / `-left` re-emitted, so
observing the ingestion never means reaching through `.agent`. Errors split by layer — the pipeline's
`onError` covers mappings and entity writes, the ingestion's `on-error` covers source starts and the
agent — and an `on-error` nobody listens for still reaches the console (`TypedEventTarget._hasListeners`).

## Source start policy

Sources start **lazily, on the first ready session**, and are shared by every session (one
subscription, one timeline). Until then — and again once every session is gone — nothing is
subscribed, and events that would have arrived are simply not received; anything that does arrive
with no scene bound is counted under the `no_binding` drop reason rather than vanishing. A failed
start is reported to `on-error` and retried by the next session to bind, so a broker that is down
when the first session comes up does not disable the ingestion for good.

If you need a source running before any viewer connects, own that transport yourself and point it at
the ingestion (it is an `EventSink`) instead of listing it in `sources`.

## Escape hatches

Every piece remains public and usable alone: the `IngestionPipeline` with no agent at all, a custom
`Transport` (register a kind on the `defaultTransportRegistry` or pass a factory), the resolvers
(`ExistingEntityResolver` / `SpawningEntityResolver` on the caching base), the
`ComponentPatchApplier`, or skip the data module entirely and wire a raw `Agent` yourself (README,
"Wiring a datasource").

## Future directions (deliberately not built yet)

- **`IngestionFleet`** — a factory managing several `SceneIngestion`s (several scenes). The current
  shapes already fit: a fleet only _manages_ self-contained ingestions.
- **`SharedSource`** — one physical broker connection fanned out to several ingestions/scenes; slots
  in as an `IngestionTransportFactory` without API changes.
- **Coalescing / backpressure** — keep-latest-per-id for very high-frequency telemetry.
- **Ordering / dedup on `source_timestamp`** — the field is now carried on every event; nothing
  consumes it yet.

## Layout (`sources/data/`)

| Folder        | Contents                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| root          | `IngestionPipeline.ts` (engine), `SceneIngestion.ts` (wiring), `SceneIngestionEvents.ts`, `EventMapping.ts`, `IngestEvent.ts`, `Transport.ts`, `IngestionStats.ts`, `SchemaValidator.ts`         |
| `transports/` | `TransportRegistry.ts`, `PlaybackTransport.ts`, `MqttTransport.ts`, `AzureEventHubTransport.ts`, `OpcUaTransport.ts` (+ `OpcUaClientModule.ts`, its optional peer declared rather than imported) |
| `resolvers/`  | `EntityResolver.ts` (caching base), `ExistingEntityResolver.ts`, `SpawningEntityResolver.ts`                                                                                                     |
| `apply/`      | `ComponentPatchApplier.ts` (write dedup)                                                                                                                                                         |
| `util/`       | `channel.ts`, `reporting.ts`                                                                                                                                                                     |
