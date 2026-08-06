# Code review — branch `agent`

> Review 2026-07-10; findings resolved by 2026-07-16. Claude Code
> `/code-review`, high effort, Claude Fable 5 (`claude-fable-5`).
> Scope: `git diff main...HEAD` plus the uncommitted working tree — the repo
> restructure into `livelink.clients/` and the extraction of the shared
> headless core (`livelink.base`) from `livelink.js`.

## Overall assessment

The extraction is clean and behavior-preserving: `livelink.js`'s old public
export surface and behavior are unchanged, CI and packaging are wired
coherently, and the old top-level `livelink.js/` tree is fully deleted. Two
of the initial findings were base-scoped (a double-started update-loop leak
and contradictory `getComponent` docs) — both fixed. Three further
correctness bugs surfaced in the shared session/scene/entity model on
2026-07-15 (a quat/euler desync on the mutate-then-flag path, a
`Session.find` / `list` contract drift from `main`, and an O(n) client
lookup on the per-frame path) — all fixed by 2026-07-16. The three design
notes (browser-only proxy-cache machinery relocated out of the headless
core, the phantom `Session` generic, invariance casts replaced by
per-consumer host types) are resolved as well. Sole leftover, minor: the js
`tests/helpers/mock-scene.ts` still casts its stub `as unknown as Scene`
(the base helper is already structurally typed).

## Status of the 2026-07-10 findings

| #   | Finding                                                                   | Status                                                                                                                                                 |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Double-started update loop leaks intervals                                | **Fixed** — `_startUpdateLoop` stops any running loop before installing new intervals, after rate validation (`LivelinkBase.ts:274`)                    |
| 2   | Contradictory `getComponent` docs                                         | **Fixed** — the class doc now describes the mutate-then-flag contract: `getComponent()` returns the current value, `updateComponent()` flags and sends it (`livelink.base/sources/scene/Entity.ts:31`) |

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

### Docs / cleanup

#### 4. Dead byte-identical copy of the quaternion module in livelink.js — FIXED 2026-07-16

`livelink.js/sources/maths/` (deleted)

`livelink.js/sources/maths/` was a byte-for-byte copy of
`livelink.base/sources/maths/` with a duplicated 120-line test; no livelink.js
source imported it (everything uses `@livelink.base/maths`). Resolved by
deleting the copy and its test — the canonical quaternion tests remain in
`livelink.base/tests/maths/`.

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
  the single centralized constructor cast. Other base callers infer the same
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

- The ES-module shadowing scheme in `livelink.js/sources/index.ts` — no dropped
  or ambiguous public exports vs `main` (the connection-stage types moved to
  `LivelinkBase` remain exported through the star re-export).
- The `assignComponentPatchInPlace` / `_setLocalTransform` array-identity
  protection for the browser transform proxies (mechanism sound; placement
  discussed in the design notes).
- CI wiring (`.gitlab-ci.yml`), workspace/package layout, and the
  `@livelink.base/*` alias build (tsc + tsc-alias).
- Coding conventions (brace rule from the user-level CLAUDE.md): no violations.
- Verification run: `npm run test` — base and js suites pass; both workspace
  packages build; `tsc --noEmit -p tsconfig.test.json` clean for both.
