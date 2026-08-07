# Code review — branches `agent`, `agent-data-sdk`

> Initial review 2026-07-10; re-reviewed 2026-07-15 after the agent SDK rework
> (`SessionPool` merged into `Agent`, `AgentEvents` rename, update-loop guard).
> Both runs: Claude Code `/code-review`, high effort, Claude Fable 5
> (`claude-fable-5`).
> Scope: `git diff main...HEAD` plus the uncommitted working tree — the repo
> restructure into `livelink.clients/`, the extraction of the shared headless
> core (`livelink.base`), the new headless agent SDK (`livelink.agent`), and
> the new samples.

## Overall assessment

The branch is a clean, well-tested refactor: the base/js split preserves the
old public export surface and behavior, CI and packaging are wired coherently,
and the old top-level `livelink.js/` tree is fully deleted. All 8 findings of
the initial review are now resolved — the agent SDK rework fixed the 4
correctness bugs in the session lifecycle plus the stale docs, and the
2026-07-16 follow-up closed the remaining cleanup items. All suites pass
(106 base + 39 agent + 139 js) and every workspace package, including the
samples, builds.

The re-review found no new correctness bug in the reworked agent lifecycle.
**All findings of both reviews are now resolved (2026-07-16)**: the `main`
session contracts were restored, `Client.client_type` exposed and used by the
default leave predicate, the leave-during-failed-join marker transfer
centralized in `#consumePendingLeave`, the dead maths copy deleted, the stale
comment rewritten, and the quat/euler mutate-then-flag desync fixed with
shadow-based re-sync on flag (finding 1). The three design notes are resolved
as well (proxy cache moved into the browser generated layer, phantom Session
generic removed via the structural `SessionClass`, invariance casts replaced
by per-consumer `SceneHost` picks). Sole leftover, minor: the js
`tests/helpers/mock-scene.ts` still casts its stub `as unknown as Scene` (the
base helper is already structurally typed).

## Status of the 2026-07-10 findings

| #   | Finding                                                                   | Status                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Unhandled rejection from the client-count listener can crash a Node agent | **Fixed** — the listener wraps the evaluation with a `.catch` dispatching `on-error` (`Agent.ts:601`)                                                                                                               |
| 2   | Leave-timer race can abandon a session with a live viewer                 | **Fixed** — the timer re-checks `should_stay` via `#leaveIfStillAlone` before leaving, and errs on staying (`Agent.ts:739`)                                                                                         |
| 3   | `leave()` during an in-flight join is silently lost                       | **Fixed** — `#leave_during_join` records the request and `#establish` aborts the join (`Agent.ts:579`)                                                                                                              |
| 4   | Double-started update loop leaks intervals                                | **Fixed** — `_startUpdateLoop` stops any running loop before installing new intervals, after rate validation (`LivelinkBase.ts:274`)                                                                                |
| 5   | Stale `context` API in docs and examples                                  | **Fixed** — README and `Agent` docs use `event.livelink` / `({ livelink, other_clients })`                                                                                                                          |
| 6   | `stop()` leaves sessions strictly sequentially                            | **Fixed** (2026-07-16) — the leaves are mapped to promises and awaited with `Promise.all` (`Agent.ts:439`)                                                                                                          |
| 7   | Sample creates entities one round-trip at a time                          | **Fixed** (2026-07-16) — the sample batches creation with a single `newEntities` call (`livelink.samples/src/lib/orbiting-animation.ts:166`)                                                                        |
| 8   | Contradictory `getComponent` docs                                         | **Fixed** (2026-07-16) — the class doc now describes the mutate-then-flag contract: `getComponent()` returns the current value, `updateComponent()` flags and sends it (`livelink.base/sources/scene/Entity.ts:31`) |

## New findings (2026-07-15)

### Correctness / behavior (most severe first)

#### 1. Mutate-then-flag skipped the quat/euler sync — FIXED 2026-07-16

`livelink.base/sources/scene/Entity.ts:374`

`updateComponent("local_transform", { orientation })` recomputed
`eulerOrientation` via `normalizeLocalTransformPatch`, but the equally
documented mutate-then-flag style —
`getComponent("local_transform").orientation = q;
updateComponent("local_transform")` — early-returned before normalization, so
a desynced component (new quaternion, stale euler) was flushed to the server.
Browser users hit the same hole through `getComponent()`, which returns the
raw stored value and bypasses the transform proxies.

Resolved by re-syncing on flag with direction detection: the base entity keeps
a shadow copy of the last-synchronized rotation pair
(`#rotation_shadow` / `#resyncLocalTransformRotation`); on a no-value
`updateComponent("local_transform")` it detects which representation the
caller mutated (exact comparison against the shadow) and recomputes the other
one, writing element-wise in place so the browser proxy-captured arrays stay
live. Both mutated → both trusted, mirroring the patch path. The shadow is
refreshed by every path that establishes a synced pair
(`_markComponentAsDirty`, `#applyComponents`, and — via the protected
`_refreshLocalTransformShadow()` — the browser constructor and
`_setLocalTransform`). Covered by 8 new base tests (`LocalTransformSync.test.ts`,
including euler-wins-after-server-update and array-identity cases) and 3 new
browser tests (`EntityTransformHandler.test.ts`).

#### 2. `Session.find` / `list` threw where `main` returned null — FIXED 2026-07-16

`livelink.base/sources/session/Session.ts:183`

On `main`, `Session.find` returned `null` on any non-OK response and
`Livelink.join_or_start` then created a session; the branch had made
`Session.list` throw and `find` / `join_or_start` propagate it. Resolved by
reverting to the `main` contract: a non-OK response is a legitimate
impossibility to list the sessions of the scene — `list` logs and resolves to
`[]`, `find` resolves to `null`. Transport-level failures (fetch rejection)
still propagate, as on `main`. Tests updated
(`livelink.base/tests/session/SessionFind.test.ts`).

#### 3. `_updateClients` linear-scanned the client list on the per-frame path — FIXED 2026-07-16

`livelink.base/sources/session/Session.ts:554`

`#onFrameReceived` calls `_updateClients` on every received frame (30–60 fps);
the rewrite had replaced `main`'s O(1) `#clients.get(client_id)` with
`this.clients.find(...)` — an array materialization plus linear scan per
metadata entry. Resolved by restoring the direct `this.#clients.get(client_id)`
map lookup, identical to `main`.

#### 4. Roster-missing fallback could keep sessions alive forever — FIXED 2026-07-16

`livelink.agent/sources/Agent.ts:190`

When `agent_roster_id` was configured but the entity missing (deleted or
misconfigured), `defaultShouldStay` fell back to "stay while any other client
is present", so two `join-all` agents in the same session each counted the
other as company and the session never met the leave condition. Resolved:
`defaultShouldStay`'s fallback now only counts clients with `client_type`
`"user"` or `"guest"` as company (using the getter added for docs finding 6),
aligning it with the `is_headless`-based rejoin policy (`#mayRejoin`). Test
stubs updated to model `client_type` and a regression test added ("leaves when
the only other client is another headless agent"). Residual caveat: an agent
authenticating with a _user_ token may be reported as `client_type: "user"`
and still count as company — `is_headless` stays the stricter signal if the
server exposes it per connected client; the roster remains the precise
mechanism. Nit: the inline fallback comment ("stay while any other client is
connected") and the `should_stay` / `agent_roster_id` config docs
(`Agent.ts:116,123`) still describe the old plain-presence fallback.

#### 5. `leave()` racing a join that then fails loses the "never rejoin" marker — FIXED 2026-07-16

`livelink.agent/sources/Agent.ts:557`

`#join`'s `finally` deleted the `#leave_during_join` marker unconditionally. If
a `leave()` landed while the join was in flight and the join then _failed_, the
marker was dropped without ever reaching `#left`, so a watch-enabled agent could
rejoin a session the user deliberately left, on a later tick. Resolved by
extracting the marker transfer into `#consumePendingLeave`, which moves the
reason to `#left` and is now called on both paths: `#establish`'s join abort and
`#join`'s `finally`. On the success path the `finally` call is a no-op —
`#establish` already consumed the marker, and no leave can land between its
check and `#records.set` (the code between them is synchronous). Regression test
added ("keeps the leave marker when a join left mid-flight then fails"); it
fails against the old `finally` (the watch loop rejoins, `join` called twice).

### Docs / cleanup

#### 6. README `should_stay` example did not compile — FIXED 2026-07-16

`livelink.agent/README.md:128`

The example predicate reads `c.client_type === "user"`, but `other_clients`
is `ReadonlyArray<Client>` and `Client` exposed no `client_type` — only `id` /
`user_id` / `username` / `is_external`. Resolved by exposing a `client_type`
getter on the base `Client` (`livelink.base/sources/session/Client.ts:81`),
which makes the example compile as written. The default `should_stay`
fallback now uses it too — see finding 4, fixed the same day.

#### 7. Dead byte-identical copy of the quaternion module in livelink.js — FIXED 2026-07-16

`livelink.js/sources/maths/` (deleted)

`livelink.js/sources/maths/` was a byte-for-byte copy of
`livelink.base/sources/maths/` with a duplicated 120-line test; no livelink.js
source imported it (everything uses `@livelink.base/maths`). Resolved by
deleting the copy and its test — the js suite drops from 151 to 136 tests
(the removed duplicates), all passing; the canonical quaternion tests remain
in `livelink.base/tests/maths/`.

#### 8. Stale comment referenced the deleted session pool — FIXED 2026-07-16

`livelink.base/sources/LivelinkBase.ts:251`

The `_startUpdateLoop` doc comment said "the public `start()` plus the session
pool's own per-session start" — `SessionPool` no longer exists and the agent
facade method is now `startUpdateLoop()`. Resolved: the comment now describes
the restart-safe behavior without referencing any concrete caller; no
session-pool references remain in the file.

### Design notes (non-blocking)

- **Browser-only machinery in the headless core** — **Resolved (2026-07-16)**,
  after re-scoping to the current code:
  - `#component_proxies` + `_getProxiedComponentValue` were still browser-only
    (grep: sole caller was `livelink.js/ci/auto-generate.js`) and were removed
    from the base `Entity`. The logic now lives in the standalone
    `ComponentProxyCache` utility (`livelink.base/sources/scene/ComponentProxyCache.ts`,
    directly unit-tested) — hosted in the shared core so a future client
    flavour can opt in, but instantiated only by the browser's generated
    `EntityComponentsProxy`, whose template stays thin glue (one field, and
    getters passing `super.<component>` as the raw value). Headless entities
    no longer allocate the proxy-cache Map and carry no proxy state.
  - `_setComponentValue` **stays in base** — the note's premise went stale:
    the base storage codegen now generates setters that call it, so the
    explicit model is a caller.
  - `assignComponentPatchInPlace` **stays in base, seam rejected**: with base
    generated setters routing patches through `updateComponent`, in-place
    identity-preserving merge is a contract of the explicit model itself (a
    `getComponent()` handle must stay live across patches for mutate-then-flag
    to work), not a browser favor — an overridable `Object.assign` seam would
    let base break its own documented pattern. The comment was rewritten to
    state the contract, and a base test now pins it ("patch merges preserve
    component and array identity", `LocalTransformSync.test.ts`), closing the
    "base tests cannot protect the invariant" concern.
  - Bonus (scratchpad SIM-4, re-verified still valid): the browser entity
    constructor no longer re-sanitizes and overwrites the base-stored
    `local_transform`; it reads the stored value back and only sanitizes a
    default when the entity came without one — the `#local_transform`-aliases-
    the-stored-component invariant is now established by reuse, not overwrite.
- **Phantom generic on the browser Session** — **Resolved (2026-07-16)**.
  `livelink.js/sources/session/Session.ts` is now `class Session extends
SessionBase<Client>` (non-generic, as on `main`) and `_instantiateClient`
  returns `Client` with no cast. Plain `extends SessionBase<Client>` alone
  broke every polymorphic static call site (TS2684 at e.g.
  `livelink.js/sources/Livelink.ts:120`): `T extends typeof Session` compares
  construct signatures, and a subclass fixing `ClientType` is not assignable
  to the generic base's `new <ClientType>(…) => Session<ClientType>` — the
  phantom generic existed to keep the subclass's construct signature
  unifiable. Fixed at the root in `livelink.base/sources/session/Session.ts`:
  the statics now constrain `this` to the structural `SessionClass`
  (`prototype` + `_make` only, no construct signature — same rationale as the
  pre-existing `InstanceOf`), with `_make` made public `@internal` and holding
  the single centralized constructor cast. Base callers (agent) infer the same
  types as before. The three `as never` casts in the event-map bridge remain:
  they bridge the event-map _extension_ (the deprecated viewport event), not
  the client generic.
- **Invariance casts instead of a host interface** — **Resolved (2026-07-16)**.
  `scene as unknown as SceneBase` (`livelink.js/sources/scene/Entity.ts`) and
  `this as unknown as Scene` into `SceneSettings`
  (`livelink.base/sources/scene/Scene.ts`) are gone. Each consumer of a scene
  now declares a local, non-exported `type SceneHost = Pick<SceneBase, …>`
  naming only the members it calls, and holds that instead of `SceneBase` /
  `Scene`: `Entity` (8 members), `ScriptEventEmitted` (`_findEntity` only) and
  `SceneSettings` (`_dispatchEvent` + `_resolveEmitter`). A `Pick` is compared
  member by member, so `SceneBase`'s invariance never arises and both the
  browser and headless `Scene` satisfy it as-is — each hand-off is an ordinary
  checked assignment. Same pattern as the pre-existing
  `LivelinkInstance.scene: Pick<SceneBase, "_findEntity">`, and as the
  `SessionClass` fix in the note above.

  Deliberately _not_ a shared exported interface: colocating each `Pick` with
  its consumer keeps the contract readable at the point of use, re-derives the
  signatures from `SceneBase` so they cannot drift, and — being local `type`
  declarations — keeps the contracts out of the public surface by construction
  rather than by relying on `stripInternal`.

  The note's closing prediction — that this would "likely let `LivelinkBase`
  drop its explicitly threaded `EntityType` parameter" — **does not hold**, and
  `LivelinkBase<EntityType, SceneType, SessionType>` is unchanged. Host types
  sidestep the invariance at the _call sites_ but do not remove it: it
  originates in `#scene_info_promise: PromiseWithResolver<SceneInfo<EntityType>>`,
  whose `get resolve(): (value: T) => void` puts `T` in a contravariant position
  alongside the covariant `readonly promise: Promise<T>` (a second source is the
  private arrow property `#onEntityReparentedByEuid`). So
  `SceneType extends SceneBase<EntityType>` still needs `EntityType` to bind.
  Dropping it would take `SceneBase<any>` or a covariance chase that any future
  arrow property would silently re-break — deliberately not attempted.

  Assessment worth recording: neither cast was hiding a bug. Both were
  unsound-but-benign — the js one asserted the true invariant (the browser
  `Scene` really is a `SceneBase<EntityType>`), and the `SceneSettings` one
  asserted a false class identity (`SceneBase<EntityType>` is not the concrete
  headless `Scene`; they are siblings) but only ever touched members inherited
  from `SceneBase` and identical on both branches. This was a hygiene fix, not
  a correctness one.

  Still open (minor): the two `tests/helpers/mock-scene.ts` keep their
  `as unknown as Scene`. Now that `Entity`'s constructor takes a `Pick` with no
  private fields, the base helper could be typed as its `SceneHost` directly and
  drop the cast — which would surface that the stub is missing `_getChildren`
  and `_findEntity`, currently hidden by the cast and only reachable if a test
  exercised those paths.

## Checked and found sound

- The agent rework itself: `#leave_during_join` abort path, `#leaveIfStillAlone`
  re-check (including erring on staying when the re-check throws), the
  `#started` gating of timers and in-flight promises, `#establish`'s
  disconnect-mid-setup handling and created/joined/ready event ordering, and
  the restart-safe `_startUpdateLoop`.
- The watch/rejoin policy (`#mayRejoin`) and its interaction with leave reasons.
- The `join_or_start` retry chain in the agent `Livelink` (failed-session
  exclusions accumulate through the wrapped selectors; empty candidate list
  falls through to `start`).
- The ES-module shadowing scheme in `livelink.js/sources/index.ts` — no dropped
  or ambiguous public exports vs `main` (the connection-stage types moved to
  `LivelinkBase` remain exported through the star re-export).
- The `assignComponentPatchInPlace` / `_setLocalTransform` array-identity
  protection for the browser transform proxies (mechanism sound; placement
  discussed in the design notes).
- CI wiring (`.gitlab-ci.yml`), workspace/package layout, and the
  `@livelink.base/*` alias build (tsc + tsc-alias).
- Coding conventions (brace rule from the user-level CLAUDE.md): no violations.
- Full verification run 2026-07-15: `npm run test` — 98 + 37 + 151 pass;
  all workspace packages and the samples build. Re-verified 2026-07-16 after
  the follow-up fixes: 98 + 39 + 136 (js drop is the deleted duplicate
  quaternion tests of finding 7; agent gained the finding-4 and finding-5
  regression tests). Re-verified again 2026-07-16 after the `SceneHost`
  extraction (types-only, counts unchanged at 98 + 39 + 136): all three
  packages typecheck and lint clean. Run 2026-07-16 after the finding-1
  fix: 106 + 39 + 139, all passing; base and js typecheck clean
  (`tsc --noEmit -p tsconfig.test.json`); base, agent and js build clean.
  Final run 2026-07-17 after the proxy-cache extraction + SIM-4 cleanup:
  112 + 39 + 139 (base gained the merge-identity contract test and the
  `ComponentProxyCache` unit tests), typechecks and builds clean; the
  generated `_prebuild/EntityComponentsProxy.ts` instantiates the base-hosted
  cache.

---

# Branch `agent-data-sdk` (2026-07-28)

> Reviewed 2026-07-28 with Claude Code, Claude Opus 5 (`claude-opus-5`).
> Scope: `git diff agent...agent-data-sdk` — the data-ingestion layer
> (`IngestionAgent` + `EventMapping` + transports/resolvers/applier), the two new
> samples (`x-headless-agent`, `x-multiplayer-game`), and the packaging changes.
> **All findings fixed the same day**; every fix is verified below.

## Overall assessment

The data module's shape is good: `EventMapping` as a plain object is a genuinely
small API for the problem, the compile-once / resolve-per-session / dedup-writes
split is clean, and `CachingEntityResolver`'s in-flight dedup (cache nulls, don't
cache throws) is right. Docs and ARCHITECTURE.md match the code.

The branch arrived **red**, though: 30 of 63 agent tests failed, and lint failed
on two spots. Both are fixed. Final state: **67 agent + 112 base + 139 js tests
pass**, all three packages typecheck, lint and build clean, and the samples app
builds and typechecks.

## Findings

| #   | Finding                                                                        | Status                                                                                                     |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | Unconditional 500 ms sleep hung 30/63 agent tests under fake timers            | **Fixed** — root cause resolved; the delay and its `roster_registration_delay_ms` knob are removed (`Agent.ts`)        |
| 2   | …and taxed every agent, including those with no roster configured            | **Fixed** — same change; the wait no longer exists                                                        |
| 3   | Debug `console.log` shipped in `livelink.react.ui` `CameraSpeedSlider`         | **Fixed** by the author                                                                                    |
| 4   | Optional-dep claim vs. reality (see the correction below)                      | **Fixed** — `node:fs/promises` made bundler-opaque; docs made precise                                    |
| 5   | A failed transport start disabled ingestion for good                           | **Fixed** — `#transport` published only after a successful start (`IngestionAgent.ts:350`)               |
| 6   | `stop()` racing an in-flight transport start leaked the connection             | **Fixed** — `#started` cleared first; the resuming start closes what it opened (`IngestionAgent.ts:262`) |
| 7   | File playback loop: unhandled rejection, file re-read per lap, empty-file spin | **Fixed** — loops from memory (`PlaybackTransport.ts`, `#scheduleNext`)                                  |
| 8   | Sample: `isHostedByMe` was `true` whenever the agent ref was null              | **Fixed** — `agent !== null && …` (`x-multiplayer-game/index.tsx:270`)                                |
| 9   | Stale `{@link DataPipeline}` / `{@link Transformer}` typedoc links             | **Fixed** — now point at `IngestionAgent` / `EventMapping`                                               |
| 10  | Samples: animation started for a session left mid-spawn                        | **Fixed** — both samples re-check `getLivelink` after the await and stop the orphan                      |
| 11  | Unreachable resolver cache invalidation                                        | **Fixed** — `IngestionAgent.forget({ id })` + optional `EntityResolver.forget`                           |
| 12  | Lint red on two pre-existing missing return types                              | **Fixed** — `data.test.ts:137`, `ingestion-agent.test.ts:95`                                             |

### 1–2. The roster registration delay

`Agent.ts` gated every session establish on
`await new Promise(resolve => setTimeout(resolve, 500))` — a TODO workaround for a
race that leaves the roster marker unregistered. `Agent.test.ts` runs under
`vi.useFakeTimers()` and never advanced that timer, so **every** `#establish`
hung: 30 tests died at the 5 s limit and the suite took 151 s instead of 0.4 s.

The workaround itself also ran unconditionally, delaying `on-session-ready` by
500 ms for the majority of agents, which configure no roster at all.

Initially worked around by moving the wait inside `#registerInRoster`, _after_
the `if (!agent_roster_id) return;` guard, and making its duration the
`leave_on_condition.roster_registration_delay_ms` knob (default 500, `0` opts
out). The underlying race in the roster marker registration has since been
found and fixed, so the delay and the `roster_registration_delay_ms` knob
(config, `#registerInRoster`, README, and the tests that set it to `0`) were
removed entirely.

### 4. Correction: the optional peers do NOT break consumer builds

The docs claimed importing the package "never pulls in" `mqtt` /
`@azure/event-hubs` / `ajv`, while the samples build emits 357 kB + 112 kB chunks
for two of them. The obvious conclusion — that a consumer without them installed
gets an unresolved-import build failure — was **tested and is wrong**. Against an
isolated fixture with only the agent dist in `node_modules`:

- **Vite 7** builds fine, emitting a 0.12 kB stub chunk per unresolvable dynamic
  import;
- **esbuild** builds fine, leaving the `import("mqtt")` calls untouched.

So the runtime promise holds — the chunks exist only where the packages are
installed, and are never fetched unless the code path runs. The docs were
imprecise, not wrong, and now say so exactly.

One real breakage did surface from that experiment: `import("node:fs/promises")`
in the playback transport (then `FilePlaybackTransport`, now `PlaybackTransport`,
where the file system is one source form among several) is a **hard resolve
error** for any browser-targeted
esbuild consumer (`Could not resolve "node:fs/promises"`, exit 1) — in a package
whose own description advertises browser compatibility, for a transport such a
consumer can never reach. Vite only warns, and stubbed it into the samples bundle.
Resolved by assembling the specifier at runtime so no bundler analyses it, with a
type-position `import(...)` preserving the types. Verified: the browser esbuild
build now exits 0, the `__vite-browser-external` stub is gone from the samples
bundle, and a Node smoke test confirms the transport still reads, replays, loops
and stops.

### 5–6. Transport lifecycle

`#ensureTransportStarted` assigned `#transport` _before_ `await transport.start()`,
so a broker that was down at first bind left a non-null, never-started transport
that made the `if (this.#transport …) return` guard short-circuit every later
binding — ingestion silently dead, `onRunning` never fired, and `stop()` calling
`stop()` on something never started.

Symmetrically, `stop()` awaited `this.#transport?.stop()` while a start was still
in its `await createTransport(...)` window: it saw `null`, stopped nothing, and
the resuming start then opened a connection nobody would ever close (enough to
keep a Node process alive). Note `#started` was only cleared in the innermost
`finally`, so checking it was not sufficient either.

Resolved together: `#started = false` moved to the first line of `stop()`, and
`#ensureTransportStarted` now starts the transport first, closes it if the agent
stopped meanwhile, and only then publishes it and fires `onRunning`. Two
regression tests added ("retries the transport on the next binding when its start
fails", "closes a transport whose start finished after stop()").

### 7. File playback loop

`#scheduleNext` looped via `void this.start()`: it re-read and re-parsed the whole
file every lap, and its rejection was unhandled (fatal under Node's default
`--unhandled-rejections=throw`). An empty JSON array also made it re-read the file
in a hot loop forever. Now it rewinds the in-memory sequence and returns early on
an empty one; both verified with Node smoke tests.

## Checked and found sound

- `EventMapping` selection (`matchChannel` including the trailing-`#` and
  segment-count edges), the compile-once target-id path, and `updates` error
  isolation.
- `CachingEntityResolver`: cache-nulls / don't-cache-throws, single in-flight
  production per id, and the `.finally` cleanup ordering.
- `ComponentPatchApplier`'s `WeakMap`-per-entity dedup and its documented
  "another client may have overwritten in between" caveat.
- `SchemaValidator`'s lazy ajv load: the rejected promise is always awaited in the
  same tick, so no unhandled rejection; first-event-only validation is deliberate.
- The `EventHubTransport` credential redaction and `EntityPath=` 2-arg/3-arg
  client construction.
- `esbuild.js`: the deliberate unminified prod build — the rationale (Node stack
  frames) is documented in place and left as the author's call; browser consumers
  now ship an unminified bundle, which is worth revisiting only if it bites.
- Coding conventions (brace rule from the user-level CLAUDE.md): no violations.

---

# Public API surface pruning — `livelink.js/sources/index.ts` (2026-08-05)

> Reviewed 2026-08-05 with Claude Code, Claude Opus 5 (`claude-opus-5`).
> Scope: the working-tree rewrite of `livelink.js/sources/index.ts` — dropping
> the star re-exports of the overridden base modules and the `*Base` alias
> re-exports, so overridden base symbols stop adding noise to the docs.
> **All findings fixed the same day.**

## Overall assessment

The pruning is safe and worth keeping: nothing in `livelink.react`,
`livelink.react.ui`, `livelink.three`, `livelink.webxr` or `livelink.samples`
imports any dropped name, and none of them existed before this branch, so no
consumer breaks.

One premise needs correcting, though. Measured against the previously generated
docs: `ClientBase`, `SessionBase`, `EntityBase`, `SceneBase`,
`SessionEventsBase`, `ClientJoinedEventBase` and `EntitiesCreatedEventBase`
**never produced a documentation page** — TypeDoc drops an aliased re-export
whose original symbol is shadowed by a same-named explicit export, so they only
ever surfaced as unlinked plain text inside generic constraints. The change
therefore shrinks the _TypeScript_ public surface (good on its own); it does not
remove doc noise, because there was none to remove. It supersedes the
"no dropped or ambiguous public exports vs `main`" note in the section above.

## Findings

| #   | Finding                                                                        | Status                                                                                     |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | `@internal` interfaces named in an explicit re-export → broken `index.d.ts`    | **Fixed** — `SceneEntityInterface` / `SceneScriptEventInterface` dropped from `index.ts`   |
| 2   | Type-only names re-exported as values (hygiene, not a breakage)                | **Fixed** — `export type` for the six of them                                              |
| 3   | Two `{@link}`s to now-unexported base classes                                  | **Fixed** — reworded in `scene/Scene.ts` and `session/Session.ts`                          |
| 4   | `SessionEvents` still constrained on the unexported `ClientBase`               | **Fixed** — constrained on the browser `Client`                                            |
| 5   | The three rebound events documented no payload at all (pre-existing)           | **Fixed** — type aliases replaced by interfaces redeclaring the payload                    |

### 1. `@internal` interfaces in an explicit re-export break the emitted `.d.ts`

`export { …, SceneEntityInterface, SceneScriptEventInterface } from "@livelink.base/scene/Scene"`.
Both interfaces are `@internal`, and `stripInternal: true` deletes them from the
emitted `Scene.d.ts` — so `index.d.ts` would re-export names that do not exist
(TS2305 for any consumer not running `skipLibCheck`). The star export it
replaced was immune, since it names nothing. Both are internal by design;
removed. Verified on the rebuilt `dist/livelink.js/sources/index.d.ts`.

Note the same latent hazard survives elsewhere: `SceneBase`'s emitted
declaration still carries `implements SceneEntityInterface<EntityType>` while
the interface itself is stripped. Pre-existing, hidden by `skipLibCheck`, not
touched here.

### 2. Type-only names re-exported as values

`LivelinkConnectionStage`, `LivelinkProgressCallback`, `SessionSelector`,
`SceneEvents`, `EntityCreationOptions` and `SceneInfo` are types, re-exported
with the value form. Nothing breaks today: `tsc` tolerates it (this project sets
neither `isolatedModules` nor `verbatimModuleSyntax`), and esbuild was tested
explicitly — a name missing from a `.ts` module is assumed to be a type and
silently dropped from the bundle, so the build stays green. Hygiene fix only:
all six now use `export type`, matching the file's own prior style and keeping
the surface honest if either flag is ever turned on.

### 5. The rebound events documented no payload (pre-existing)

`EntitiesCreatedEvent`, `ClientJoinedEvent` and `ClientLeftEvent` were published
as `@internal const` + `type X = XBase<…>`. TypeDoc renders such an alias as a
bare reference with a type-parameter table and **no members**, so
`event.entities` / `event.client` were documented nowhere — and, the `*Base`
class having no page, nothing linked there either. Independent of the pruning
above; the pruning only made it more visible.

Dropping the rebinding was rejected: `livelink.react` annotates
`(event: EntitiesCreatedEvent)` explicitly (`hooks/useEntities.ts:213`) and
feeds the result to a `setEntities(Entity[])`, so the browser-flavour default is
load-bearing.

Resolved by keeping the `const` (same class ⇒ `instanceof` unchanged) and making
the type half a **generic interface extending the base event class** that
redeclares the payload member, with `@noInheritDoc` as every event class here
already does. The pages now render the payload
(`docs-md/interfaces/EntitiesCreatedEvent.md` et al.). Residual cosmetic: the
`Hierarchy` / `Overrides` lines still name the base class as plain text —
accepted for the exactness of extending it.

## Verification (2026-08-05)

`livelink.js` typechecks (`tsconfig.test.json`) and lints clean; 147 tests pass;
`build:js` (esbuild + tsc + tsc-alias) emits a clean `index.d.ts`, and
`dist/index.mjs` still exports the three event classes as functions. Downstream
`build:react`, `build:three`, `build:webxr`, `build:react.ui` and
`build:samples` all pass. `dev-docs:js` reports 0 errors and 2 warnings, both
pre-existing and unrelated (`Session._updateClients` link, `ComponentProxyCache`
not exported).

## Event documentation follow-up (2026-08-05)

Two further defects found by reading the regenerated pages, both fixed.

### 9. Event maps documented a fraction of their entries

Measured in the generated HTML:

- `types/SceneEvents.html` linked `EntitiesDeletedEvent` and
  `SceneSettingsUpdatedEvent` but **not** `EntitiesCreatedEvent` — a regression
  from finding 5. The map lives in the shared base and names the shared class
  symbol, which has no page; the browser interface of the same name is a
  different symbol.
- `types/SessionEvents.html` documented **one key out of six**. Pre-existing:
  the map was `SessionEventsBase<ClientType> & { … }` and TypeDoc expands only
  the literal half of an intersection, so `ClientJoinedEvent`,
  `ClientLeftEvent`, `DisconnectedEvent`, `InactivityWarningEvent` and
  `ActivityDetectedEvent` never appeared at all.
- The same intersection defect was found and fixed in the agent SDK's
  `SceneIngestionEvents` (`Omit<AgentEvents, "on-error"> & { … }`), which hid
  the four re-emitted session events.

Resolved by declaring all three maps key by key against the flavours their SDK
publishes. `Scene` needs no bridge (the browser map is structurally identical to
the shared one); `Session` keeps its existing `as never` bridge. Verified: all
three entries linked on `SceneEvents`, all six on `SessionEvents`, all eight on
`SceneIngestionEvents`.

The duplication that buys is guarded by `livelink.js/tests/EventMaps.test.ts`
and `livelink.agent/tests/EventMaps.test.ts` — type-level mutual-assignability
assertions that fail to compile on drift. The helper was checked against a
missing key, an extra key and a retyped entry; all three break it.

### 10. No event said who emits it

Pre-existing, `main` included. The emitter was only recoverable indirectly, via
`Scene extends TypedEventTarget<SceneEvents>` and the map's entries — landing on
an event page from search told you nothing about where to listen.

Every event now carries `Dispatched by {@link X} as \`event-name\`.`, and every
map the reciprocal `The events dispatched by {@link X}.` — 24 events across the
three packages. In the shared base the links are written unqualified so they
resolve to each SDK's own flavour; verified in both outputs
(`livelink.js/docs/interfaces/EntitiesCreatedEvent.html` → browser `Scene.html`,
`livelink.agent/docs/classes/EntitiesCreatedEvent.html` → headless `Scene.html`).
`ScriptEvents.ts` imports `Entity`, so a link there would bind to the shared
symbol; it uses unlinked prose naming `addScriptEventListener` instead.

### Verification

All three packages typecheck (`tsconfig.test.json`) and lint clean.
**112 base + 171 agent + 148 js tests pass.** `build:base`, `build:agent`,
`build:js`, then `build:react`, `build:three`, `build:webxr`, `build:react.ui`
and `build:samples` all pass. `npm run dev-docs` (js + agent, HTML and markdown):
still **0 errors / 2 warnings**, the same two pre-existing ones — no `{@link}`
added here failed to resolve.

## `ComponentProxyCache` relocated to `livelink.js` (2026-08-06)

The 2026-07-17 extraction (finding above) parked `ComponentProxyCache` in
`livelink.base/sources/scene/` so "a future client flavour could opt in". That
flavour never appeared, and it structurally cannot: the cache is the browser's
proxied component model, which the base and agent SDKs deliberately do not have
— their entities hand out raw stored values and carry no proxy state.

So the shared core was hosting a class it can never use. The class moved to
`livelink.js/sources/scene/ComponentProxyCache.ts`, next to the `ComponentHandler`
it builds proxies with — the same shape of neighbour: browser-only, `@internal`,
and typing its `entity` as the _base_ `Entity`, so neither drags browser code
into the core. Its unit tests moved alongside to `livelink.js/tests/scene/`
(js's `tests/helpers/mock-scene.ts` already re-exports base's `createMockScene`).
The rule this originally illustrated is unchanged: the logic stays a hand-written,
directly-compiled, unit-tested class, and `EntityComponentsProxy.template.ts` stays
thin glue — one field plus one-line generated accessors.

Incidental fix: the template's `{@link ComponentProxyCache}` pointed at a symbol
no package exports, which was one of the two standing `dev-docs:js` warnings. The
comment now describes the caching in prose instead, so **`dev-docs:js` is down to
0 errors / 1 warning** (the `Session._updateClients` link).

### Verification

All three packages typecheck (`tsconfig.test.json`); `livelink.js` lints clean.
**107 base + 171 agent + 153 js tests pass** — the 5 `ComponentProxyCache` cases
moved from base to js, every other count unchanged. `npm run build` (base, agent,
js, react, three, react.ui, webxr) and `build:samples` all pass; the agent build
is the proof the headless bundle never reached the class. No
`@livelink.base/scene/ComponentProxyCache` specifier survives anywhere.

---

# `livelink.agent/samples` folded into the package (2026-08-07)

> Scope: retiring the standalone `livelink.agent/samples` npm package, installing
> `node-opcua-client` as a devDependency, and switching `OpcUaClientModule.ts` to
> the real upstream types.

## Why

`samples/` carried its own `package.json`, `package-lock.json`, `.npmrc`,
`.gitignore` and **two** tsconfigs, plus a private `node_modules`. Every one of
those existed for a single reason: keeping `node-opcua-client` (~90 Node-only
packages) out of the root `node_modules`, where npm workspace hoisting would
expose it to `livelink.samples`' Vite build. The `.npmrc`'s `install-links=true`
and the deliberate "does NOT extend" split between `tsconfig.json` and
`tsconfig.runtime.json` were both consequences of that one constraint.

This **supersedes** the 2026-07-28 finding-4 note ("declared rather than
installed") for `node-opcua-client`. That note's reasoning still holds for what it
was: the type-safety cost was real, and the transport's tests run against a fake
that would keep passing through upstream drift — so the type check was the only
thing standing behind those six calls, and it was switched off.

What the earlier decision did not weigh is that the hazard's blast radius is
exactly **one file**. Measured, not assumed:

- `livelink.samples` is the only browser-bundled consumer of the agent
  (`livelink.react`, `.react.ui`, `.three`, `.webxr` do not depend on it);
- `mqtt` and `ajv` were **already** hoisted devDependencies producing 357 kB and
  112 kB chunks in that same bundle — the identical mechanism, already lived with,
  tolerated only because those two are browser-capable;
- the opcua tree needs no native builds (no install scripts), so the cost is
  install time and disk only.

## Changes

| Area | Change |
| ---- | ------ |
| `livelink.samples/vite.config.ts` | Excludes `node-opcua-client` from `optimizeDeps` (dev server) and `build.rollupOptions.external` (production) |
| `livelink.agent/package.json` | `node-opcua-client` + `tsx` as devDependencies; `sample:mqtt`, `sample:opcua`, `generate:x-agent-data-ingestion`, `typecheck:samples` scripts |
| `livelink.agent/tsconfig.samples.json` | One config replacing `samples/tsconfig.json` + `samples/tsconfig.runtime.json` |
| `OpcUaClientModule.ts` | Real `import type` for the module and the four instance types; `optional-peers.d.ts` deleted |
| `eslint.config.mjs` | `samples/**` now parsed with `tsconfig.samples.json` |
| `samples/` | `package.json`, `package-lock.json`, `.npmrc`, `.gitignore`, both tsconfigs and `node_modules` deleted; a one-line `tsconfig.json` shim added back (see below) |

Two things surfaced during the work that the plan had flagged as open questions,
both resolved by measurement rather than assumption:

1. **The `paths` remap is required**, not redundant. Without it the compiler
   follows the workspace symlink into `sources/index.ts` and checks the samples
   against the implementation, dragging in the livelink.base sources and esbuild's
   ambient globals (`API_HOSTNAME`, TS2304). It is kept, mapping to the package
   *directory* so tsx can execute what it resolves.
2. **The generator's default output path was cwd-relative** (`../../../livelink.samples/…`),
   computed for a cwd of `samples/`. Running it from the package root wrote one
   directory too high (ENOENT). Re-anchored to `__dirname`, so it is
   cwd-independent.

`OpcUaVariant` / `OpcUaDataValue` deliberately stay narrow structural projections
rather than aliases of the real `Variant` / `DataValue`: they name only the fields
the decoder reads, which keeps a test sample a plain object literal. They are
pinned **field by field** in `opcua-transport.test.ts` — whole-object assertions
would be vacuous, since every field is optional and TypeScript's weak-type check
passes on a single overlapping field, letting an upstream *rename* through.
Verified by mutation: renaming `dataType` and retyping `sourceTimestamp` each break
the build; reverting restores it.

### Follow-up: the editor lost the samples (found after the fact)

Deleting `samples/tsconfig.json` broke VS Code without breaking the CLI. tsserver picks a project by
walking up for a file named literally `tsconfig.json` — it never auto-discovers
`tsconfig.samples.json` — and the first one it finds, the package's own, is sources-only. The sample
scripts therefore landed in an **inferred project** with default options: no `types: ["node"]`, so
`process` and `__dirname` stopped resolving in the editor while `typecheck:samples` stayed green,
because that script names its config explicitly and the editor cannot.

This walked into a convention the repo had already established and documented: every package carries
a `tests/tsconfig.json` that is a one-line `extends` whose comment says it "exists solely so the VS
Code TypeScript language server auto-discovers a config". The fix is the identical shim for
`samples/`, and the two remaining tsconfigs are still one fewer than the three the standalone package
carried (`tsconfig.json` + `tsconfig.runtime.json` + its `package.json`).

Worth recording as a review lesson: a green CLI is not evidence the editor works, and the two
diverge exactly where a config is selected by name rather than passed by flag. Verified by comparing
the shim against the real config — same 5 files in the program, same resolved `types` / `lib` /
`paths`, and `@3dverse/livelink-agent` still resolving to `dist/` rather than `sources/` (a leak
would have reproduced the `API_HOSTNAME` TS2304 that the `paths` remap exists to prevent).

## Verification

- **107 base + 172 agent + 153 js tests pass** (agent +1: the new projections test).
- All three packages typecheck; `livelink.agent` lints clean (exit 0).
- `npm run build` (base, agent, js, react, three, react.ui, webxr) and
  `build:samples` all pass.
- **The critical check** — the emitted browser bundle contains no `node-opcua-*`
  chunk, and the only `node-opcua-client` occurrences in `index-*.js` are the
  externalized bare specifier plus its error-message string. No package code.
  Marginally better than before, in fact: Vite previously emitted an empty stub
  chunk that would resolve and then fail with a `TypeError` on `.OPCUAClient`;
  the specifier now stays unresolvable, so the transport's own `catch` produces
  the friendly "install node-opcua-client" message.
- No emitted `.d.ts` references `node-opcua-client` as a type — `stripInternal`
  removes every `@internal` OPC UA declaration, so a consumer who installs no such
  peer still sees nothing of it. The lazy `import()` remains `external` in the
  agent's own esbuild config; the runtime contract is unchanged.
- Runtime resolution verified both ways: the built `dist` resolves
  `node-opcua-client` from the root `node_modules`, and `tsx` resolves
  `@3dverse/livelink-agent` to the built `dist` through the `paths` remap.
- `generate:x-agent-data-ingestion` is deterministic across runs and reproduces the
  committed recording byte-for-byte.
