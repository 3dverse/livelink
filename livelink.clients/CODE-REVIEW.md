# Code review — branch `agent`

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
