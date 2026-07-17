# Architecture — `livelink.clients/`

This folder hosts the family of 3dverse client SDKs. It contains three sibling
packages built around one shared, headless core:

```
livelink.clients/
├── livelink.base/     @3dverse/livelink-base   (private — never published)
├── livelink.js/       @3dverse/livelink        (browser SDK)
└── livelink.agent/    @3dverse/livelink-agent  (headless agent SDK, Node + browser)
```

```
                 ┌────────────────────────┐   ┌──────────────────────────┐
                 │   @3dverse/livelink    │   │ @3dverse/livelink-agent  │
                 │      (livelink.js)     │   │     (livelink.agent)     │
                 │                        │   │                          │
                 │ streaming / rendering  │   │  Agent (attach policy)   │
                 │ viewports / inputs     │   │  watch & leave policies  │
                 │ audio / proxied Entity │   │  headless Livelink       │
                 └───────────┬────────────┘   └────────────┬─────────────┘
                             │      bundles (source alias) │
                             ▼                             ▼
                 ┌─────────────────────────────────────────────────────┐
                 │        livelink.base  (shared headless core)        │
                 │  LivelinkBase · Session/Client · SceneBase/Entity   │
                 │  EntityRegistry · TypedEventTarget · config · maths │
                 └───────────────────────────┬─────────────────────────┘
                                             │ npm dependency
                                             ▼
                              @3dverse/livelink.core
                       (protocol, gateway connection, types)
```

## Package roles

### `livelink.base` — the shared headless core

Everything that does not depend on a browser: the connection facade, the
session/client model, the scene/entity model, dirty-state tracking and the
update loops. It is **private and never published**: the two SDKs consume it
as a _source folder_ through the `@livelink.base/*` import alias and compile /
bundle it into their own artifacts. There is exactly one copy of the core
logic at runtime — inside whichever SDK you installed.

Key modules (`livelink.base/sources/`):

| Module                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LivelinkBase.ts`               | Abstract connection facade: owns the `LivelinkCore`, registers the client, installs/uninstalls the core event listeners, runs the update & broadcast loops that flush dirty entities and scene settings (restart-safe: starting the loop again stops any loop already running). Also defines the shared connection-stage vocabulary (`LivelinkConnectionStage` / `LivelinkProgressCallback`) used by both facades' `onProgress` callbacks. |
| `LivelinkInstance.ts`           | Minimal structural interface (`session`, `scene`, `_updateEntities`) so `Session`, `Client` and `SceneBase` stay decoupled from any concrete facade.                                                                                                                                                                                                                                                                                       |
| `session/Session.ts`            | Session REST lifecycle (`create` / `list` / `find` / `findById` / `findByGuestToken`), client registration against the gateway, connected-client map, session events. Generic in its `ClientType`.                                                                                                                                                                                                                                         |
| `session/Client.ts`             | A connected client, reduced to its identity (`id`, `user_id`, `username`, `client_type`, `is_external`). What a client _shows_ comes from the client metadata piggybacked on the video frames, so it lives on the browser SDK's subclass — see below.                                                                                                                                                                                       |
| `scene/Scene.ts`                | `SceneBase<EntityType>`: entity creation/lookup/deletion, script events, incoming core events (`_onEntitiesCreated`, `_updateEntityFromEvent`, …). Abstract `_instantiateEntity` lets each SDK produce its own entity flavour. Also exports the concrete headless `Scene`.                                                                                                                                                                 |
| `scene/Entity.ts`               | The headless entity with the **explicit component model** (see below), dirty/deleted component sets, script event targets, parenting.                                                                                                                                                                                                                                                                                                      |
| `scene/ComponentProxyCache.ts`  | Standalone stable-Proxy cache for client flavours exposing a proxied component model; instantiated only by the browser SDK's generated `EntityComponentsProxy`.                                                                                                                                                                                                                                                                            |
| `scene/EntityRegistry.ts`       | RTID/EUID lookup tables, dirty & broadcast lists — generic in `EntityType`.                                                                                                                                                                                                                                                                                                                                                                |
| `TypedEventTarget.ts`           | Typed wrapper over DOM `EventTarget`, the event backbone of every layer.                                                                                                                                                                                                                                                                                                                                                                   |
| `config/api.ts`                 | Mutable API base URL (`getApiUrl` / `setApiUrl`), surfaced by the facades as `Livelink._api_url`.                                                                                                                                                                                                                                                                                                                                          |
| `config/env.ts`                 | `BROWSER_ENV` / `NODE_ENV` detection without relying on DOM or Node ambient types.                                                                                                                                                                                                                                                                                                                                                         |
| `_prebuild/EntityComponents.ts` | **Generated** (see "Code generation"): the component storage class with one accessor per engine component.                                                                                                                                                                                                                                                                                                                                 |

### `livelink.js` — the browser SDK

Extends the core with everything rendering- and input-related: frame
streaming and decoding (`rendering/streaming/`), viewports, camera
controllers and projections (`rendering/camera/`), canvas/WebGL surfaces
(`rendering/surfaces/`), mouse/keyboard/gamepad inputs (`inputs/`), and audio.

Its `Livelink` class `extends LivelinkBase<Entity, Scene, Session>` and adds
the streaming lifecycle (`configureRemoteServer`, `addViewports`,
`setEncodedFrameConsumer`, `startStreaming`). It ships thin subclasses of the
core model classes:

- `scene/Entity.ts` — browser entity: **proxied component accessors** plus the
  transform layer (`local_transform` / `global_transform` proxy handlers, lazy
  `ls_to_ws` / `ws_to_ls` matrices, parent-chain dirty propagation).
- `scene/Scene.ts` — implements `_instantiateEntity` to produce browser entities.
- `session/Session.ts` / `session/Client.ts` — fix the base generics to the
  browser `Client` so events and lookups yield the browser flavours, and own the
  **client metadata**: the camera entities a client views the scene through and
  the 3d data under its mouse pointer arrive piggybacked on the video frames, so
  `Session._updateClients` (fed by the frame handler) and the state it writes on
  `Client` only exist where there is a stream.

### `livelink.agent` — the headless agent SDK

A small SDK for driving sessions programmatically (bots, server-side logic),
with no rendering at all. Runs in Node.js or the browser.

- `Livelink.ts` — headless facade: `Livelink.start` / `join` / `join_or_start`
  and a public `startUpdateLoop()` that launches the shared update loop.
  Exposes the core almost as-is (`extends LivelinkBase<Entity, Scene, Session>`
  using the _base_ entity/scene directly).
- `Agent.ts` — the user-facing class and the session-attachment policy engine in
  one (`extends TypedEventTarget<AgentEvents>`, so you listen on the agent
  itself). Exposes `start` / `stop` / `join` / `leave`, the attached
  `livelinks` / `getLivelink`, and single-session conveniences (`session`,
  `scene`). The policy it implements:
  - **modes**: `start`, `join`, `join-or-start` (default), `join-all`, `manual`;
  - **watch loop**: polls the session list and joins sessions as they appear
    (`join` / `join-all` modes only), with a per-reason rejoin policy;
  - **leave-on-condition**: leaves a session once a configurable `should_stay`
    predicate has been false for `after_seconds`; the default predicate can use
    an `agent_roster` entity (each agent registers a marker child named after
    its client id) to distinguish real viewers from other agents;
  - sessions are listed/started/joined through the `Session`/`Livelink` statics
    directly; tests spy on those statics rather than injecting a seam.
  - a single `#started` flag gates everything reached from a timer or an
    in-flight promise, and a pending-leave map catches `leave()` / `stop()`
    calls that land while a join is still in flight, so the agent never ends
    up attached to a session it was asked to leave;
  - the leave timer re-checks `should_stay` before actually leaving
    (`#leaveIfStillAlone`), so a stale async evaluation can never abandon a
    session that has a live viewer.
- `AgentEvents.ts` — `on-session-created/joined/ready/left`, `on-error`;
  every event carries the session's `livelink`.

## The two component models

Both SDKs share one storage layer, `_prebuild/EntityComponents`, but expose it
differently:

- **Explicit model (base + agent)** — components are read through
  `getComponent()` (live value) or the generated getters, patched through
  `updateComponent()` / `updateComponents()` (apply a partial patch and/or
  flag dirty — "mutate-then-flag") or the generated setters (`entity.foo =
  patch` delegates to `updateComponent` / `deleteComponent`), and removed with
  `deleteComponent()`. No magic: mutations are only sent once flagged, and
  patch merges preserve object and array identity, so a `getComponent()`
  handle stays live across patches. One exception on flag: `local_transform`
  re-synchronizes its two rotation representations — a shadow copy of the
  last-synced pair detects whether the caller mutated `orientation` or
  `eulerOrientation`, and the other one is recomputed from it (both mutated →
  both trusted, like on the patch path).
- **Proxied model (browser)** — the generated `EntityComponentsProxy`
  accessors return stable `Proxy` objects so nested mutations
  (`entity.point_light.color[0] = 1`) automatically flag the entity dirty,
  and setters delegate to `updateComponent` / `deleteComponent`.
  React-friendly: proxies are cached per component so reference identity
  survives re-renders. The caching logic lives in the shared core as the
  standalone `ComponentProxyCache` utility (reusable by any future client
  flavour), but only the browser's generated layer instantiates it — headless
  entities hand out the raw stored values and carry no proxy state, and the
  codegen template stays thin glue.

Three invariants keep the browser transform proxies coherent:

1. Local patches are merged with `assignComponentPatchInPlace`, which copies
   arrays element-wise instead of replacing them — the explicit model's
   identity-preservation contract (pinned by a base test), of which the array
   references captured by `LocalTransformHandler` are one consumer.
2. Server-driven updates go through the browser entity's
   `_applyComponentsUpdate` override, which routes `local_transform` to
   `_setLocalTransform` (in-place `vec3.copy`/`quat.copy`) for the same reason,
   and keeps the quaternion/euler representations in sync.
3. The mutate-then-flag rotation shadow (see above) is refreshed by every path
   that establishes a synchronized pair — `_markComponentAsDirty`, the base
   `#applyComponents`, and the browser constructor / `_setLocalTransform` via
   the protected `_refreshLocalTransformShadow()` — and its re-sync writes
   element-wise in place, so the proxy-captured arrays stay live there too.

## Data flow

```
user code ──► Entity.updateComponent / proxy mutation
                    │  (dirty set + EntityRegistry dirty list)
                    ▼
   LivelinkBase update loop (updatesPerSecond) ──► core.updateEntities(persist: false)
   LivelinkBase broadcast loop (broadcastsPerSecond) ──► core.updateEntities(persist: true)

server ──► core events (on-entities-updated, on-client-connected, …)
                    │  (installed by LivelinkBase._installCoreEventListeners)
                    ▼
   SceneBase / Session handlers ──► TypedEventTarget events on Scene / Session / Entity
```

## Generics: how each SDK gets its own flavour

The core is written once but must hand out browser entities in the browser SDK
and plain entities in the agent SDK. This is threaded through three seams:

- `LivelinkBase<EntityType, SceneType, SessionType>` with abstract
  `_createScene` (the entity type is threaded explicitly because
  `SceneBase` is _invariant_ in its entity type);
- `SceneBase<EntityType>` with abstract `_instantiateEntity`;
- `Session<ClientType>` with overridable `_instantiateClient`. The browser SDK
  subclasses it _non-generically_ (`Session extends SessionBase<Client>`); to
  keep the polymorphic statics (`create` / `find` / …) callable on such a
  subclass, their `this` constraint is the structural `SessionClass`
  (`prototype` + `_make` only) instead of `typeof Session`, which would compare
  construct signatures and reject any subclass that fixes `ClientType`.

### Host types: don't name `SceneBase` just to use a scene

`SceneBase`'s invariance is the recurring friction here. It holds a
`PromiseWithResolver<SceneInfo<EntityType>>`, whose `resolve` getter puts
`EntityType` in a contravariant position, so `SceneBase<browserEntity>` is _not_
assignable to `SceneBase<Entity>`. That is why `LivelinkBase` threads
`EntityType` explicitly — and it is a property of `SceneBase` itself, not of its
call sites: no amount of restructuring around it will let `LivelinkBase` drop
that parameter.

The consequence for everything that merely _uses_ a scene: naming `SceneBase` as
your type forces an unchecked `as unknown as` at every hand-off. Instead, declare
a **host interface** naming only the members the consumer calls, and have
`SceneBase` declare `implements` against it:

```ts
// Scene.ts
export interface SceneScriptEventInterface<EntityType extends Entity = Entity> {
    _findEntity(params: { entity_rtid: RTID }): Promise<EntityType | null>;
}

export abstract class SceneBase<EntityType extends Entity = Entity>
    extends TypedEventTarget<SceneEvents<EntityType>>
    implements SceneEntityInterface<EntityType>, SceneScriptEventInterface<EntityType>
{ ... }
```

Member-by-member interface comparison sidesteps the invariance — `implements`
checks it once at the `SceneBase` declaration instead of with a cast at every
call site — and every `Scene` flavour satisfies it as-is. Each consumer gets its
own minimal interface, declared alongside `SceneBase` in `scene/Scene.ts`
(`SceneEntityInterface` for `Entity`, `SceneScriptEventInterface` for
`ScriptEventEmitted`) and listed in `SceneBase`'s `implements` clause; the
consumer module imports the interface by name instead of declaring its own
local `Pick`. `SceneSettings` still declares its own local, non-exported
`type SceneHost = Pick<SceneBase, "_dispatchEvent" | "_resolveEmitter">`, and
`LivelinkInstance.scene` its own `Pick<SceneBase, "_findEntity">` — the plain
`Pick` idiom, not yet migrated to this pattern; `SessionClass` is the same idea
for the session statics.

Unlike a local, unexported `Pick`, these interfaces have to be exported
(`SceneBase` lives in `Scene.ts`, a different module than most consumers, and
must be able to name them) — they stay out of the public docs surface via
`@internal` instead of by not being exported. The trade-off versus `Pick` is
that `SceneBase` must keep matching each interface by hand instead of the
`Pick` re-deriving signatures automatically from `SceneBase` itself.

Keeping the `Pick`s local and unexported also keeps them out of the public
surface by construction.

## Public API surface

Each SDK's `sources/index.ts` star re-exports the shared base modules and then
_shadows_ the few classes it overrides with explicit named re-exports (ES
module semantics: explicit exports win over star exports). The shadowed base
symbols remain public under alias names (`SessionBase`, `ClientBase`,
`EntityBase`, `SessionEventsBase`, …) so they keep a documented, linkable
identity.

## Build & packaging

- **Code generation** (`livelink.base/ci/auto-generate.js` + templates): reads
  the engine component declarations from
  `@3dverse/livelink.core/dist/_prebuild/engine_types/components.d.ts` and
  generates `_prebuild/EntityComponents.ts` (component storage + explicit
  accessors). `livelink.js/ci/auto-generate.js` additionally generates the
  browser flavour (`_prebuild/EntityComponentsProxy.ts`, proxied accessors). Runs
  as `prebuild`/`pretest` in each package.
- **Bundling** (per-SDK `esbuild.js`): bundles `sources/index.ts` to
  `dist/index.mjs` + `dist/index.cjs`, resolving the `@livelink.base/*` alias
  to `../livelink.base/{sources,_prebuild}` so the core is compiled in.
  Build-time defines inject `PACKAGE_NAME`, `LIVELINK_VERSION` and
  `API_HOSTNAME`.
- **Type declarations** (per-SDK `tsconfig.json`): `tsc` runs with
  `emitDeclarationOnly` and `rootDir: ".."` (spanning `livelink.clients/`), so
  `dist/` contains both `livelink.<sdk>/sources/**.d.ts` and
  `livelink.base/**.d.ts` with declaration maps pointing at the canonical
  sources; `tsc-alias` then rewrites the `@livelink.base/*` specifiers to
  relative paths so `dist` is self-contained for consumers.
- **Workspaces**: the root `package.json` declares `livelink.clients/*` as npm
  workspaces; root scripts build in dependency order
  (`build:base → build:agent → build:js → …`).

## Testing

Each package has its own `vitest` suite under `tests/`:

- `livelink.base/tests/` — core model tests (component dirty classification,
  transform sync, session find, events, filters) against a mock scene helper;
- `livelink.agent/tests/` — `Agent` policy tests (start/stop lifecycle, modes,
  watch loop, leave-on-condition, roster, stop/rejoin) spying on the
  `Session.list` / `Livelink` connection statics;
- `livelink.js/tests/` — browser-flavour tests (proxied component identity,
  transform handling, rendering events).
