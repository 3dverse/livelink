# Release triggering for livelink.base changes

`livelink.base` is `"private": true` and is consumed as a **source folder via a build alias**
(`@livelink.base/*`), not as an npm dependency of `@3dverse/livelink` or
`@3dverse/livelink-agent` — neither package lists it in `dependencies`/`devDependencies`. Because
Changesets' version-bump cascade only walks the `package.json` dependency graph, a
`livelink.base`-only change produces no changeset for the published packages by default.

## Current approach (in production)

[`.gitlab-ci.yml`](../../.gitlab-ci.yml)'s `version:update-version` job detects `git diff`s touching
`livelink.clients/livelink.base/` and hand-writes a `.changeset/base-release.md` naming
`@3dverse/livelink` and `@3dverse/livelink-agent` directly with a patch bump, inlining the
`livelink.base` commit subjects as the changeset summary.

**This is the correct approach for this repo, and the alternative below has been ruled out.** Do not
re-investigate it.

## Ruled out: wiring livelink.base into the Changesets graph

The idea was to declare `@3dverse/livelink-base` as an internal dependency of `livelink.js` and
`livelink.agent` so that `updateInternalDependents: "always"` (in
[`.changeset/config.json`](../../.changeset/config.json)) would cascade the patch bump on its own,
shrinking the CI script to "write one changeset naming only `@3dverse/livelink-base`". Three
independent blockers, each verified:

**1. A `devDependencies` edge never bumps anything.** This was the specific form originally
proposed, and it cannot work by construction. In `determineDependents`
(`@changesets/assemble-release-plan`), the `devDependencies` branch assigns `type = "none"`; only
`dependencies`, `optionalDependencies` and `peerDependencies` yield `"patch"`. `assembleReleasePlan`
says so in a comment: devDeps are in the graph *only* so `apply-release-plan` can rewrite their
version ranges. Measured: both consumers appear in the release plan at `type: none`, i.e. same
version in, same version out.

**2. npm does not implement the `workspace:` protocol.** `bumpVersionsWithWorkspaceProtocolOnly:
true` is set in our config, and `getDependencyGraph` (`@changesets/get-dependents-graph`) `continue`s
past every dependency whose range does not start with `workspace:` — so that is the only range form
that produces a graph edge here. But this is an npm workspace, and `npm install` rejects it outright:

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

`workspace:` is a pnpm/yarn feature (npm/cli#3847 is still open). Adding it breaks `npm install` for
every developer and every CI job, so it is not available to us at any price.

**3. The only npm-installable variant costs 4 extra publishes per release.** Dropping
`bumpVersionsWithWorkspaceProtocolOnly` lets a plain `"^0.8.64"` range into the graph and does make
the cascade fire — but the flag is repo-wide and the cascade is transitive, so it simultaneously
wakes up every other internal edge (the `@3dverse/livelink` peer ranges in `livelink.react`,
`livelink.three`, `livelink.webxr`, `livelink.react.ui`):

| Scenario | Today | With the flag dropped |
| --- | --- | --- |
| `livelink.base`-only change | 2 packages published | **6 packages published** |
| Routine `livelink.js` change | 1 package published | **5 packages published** |

It also makes every Changesets run log 6 range-validation errors for `livelink.samples`' `file:`
dependencies (non-fatal — `getDependentsGraph` discards the `valid` flag — but permanent noise).
There is no way to scope the flag to a single dependency edge.

On top of all three: `changesets-tools generate-changesets` does not map `livelink.base` commits to
a package (it emitted `Generated changesets : []` for a `feat(livelink.base): ...` commit), so a CI
script writing the changeset would still be needed either way. The only thing the alternative could
ever have removed is the hardcoded two-package consumer list.

### A note on the changelog

The cascade would also have made the *published* changelog worse, not better. A cascaded entry reads:

```
- Updated dependencies
  - @3dverse/livelink-base@0.8.65
```

which points at a package no npm consumer can look up. The current script inlines the actual
`livelink.base` commit subjects into the consumer changelog instead, which is what a reader on npm
can actually use.

### Correction to an earlier assumption

`privatePackages.version` defaults to **`true`** (`@changesets/config`, not the `false` previously
assumed here), so `livelink.base` was always eligible for versioning — that was never the obstacle.
The practical consequence is that a changeset *may* name `@3dverse/livelink-base` directly. It just
does not pull its consumers along.

## How this was verified

The release plan can be computed in-process without a worktree, without `npm install`, and without
mutating anything — `@changesets/cli version` is never invoked:

```js
const { getPackages } = require("./node_modules/@manypkg/get-packages");
const { read } = require("./node_modules/@changesets/config");
const assembleReleasePlan = require("./node_modules/@changesets/assemble-release-plan").default;

const packages = await getPackages(repoRoot);
const config = await read(repoRoot, packages);

// patch the in-memory manifests to try an edge, e.g.:
// packages.packages.find(p => p.packageJson.name === "@3dverse/livelink")
//     .packageJson.dependencies["@3dverse/livelink-base"] = "workspace:*";

const plan = assembleReleasePlan(
    [{ id: "sim", summary: "…", releases: [{ name: "@3dverse/livelink-base", type: "patch" }] }],
    packages,
    config,
    undefined,
    undefined,
);
console.log(plan.releases.map(r => `${r.name} ${r.oldVersion} -> ${r.newVersion} (${r.type})`));
```

Results for a changeset naming only `@3dverse/livelink-base`:

| Edge added to `livelink.js` + `livelink.agent` | Consumers bumped |
| --- | --- |
| none (today) | none |
| `devDependencies: "workspace:*"` | none — both `type: none` |
| `devDependencies: "*"` | none — edge dropped from the graph |
| `dependencies: "*"` | none — edge dropped from the graph |
| `dependencies: "workspace:*"` | both — but `npm install` fails |
| `peerDependencies: "workspace:*"` | both — but `npm install` fails |

Measured against `@changesets/cli` 2.31.0 (`assemble-release-plan` 6.0.10,
`get-dependents-graph` 2.1.4, `config` 3.1.4) and npm 12.0.2. Note that `version:update-version` runs
`npx @changesets/cli version` without a prior install, so the CLI version used in CI floats — worth
re-checking these numbers if its behaviour ever looks different from the above.

## Possible refinement (optional, not implemented)

The CI-written changeset could name `@3dverse/livelink-base` *in addition to* the two consumers.
Verified to be accepted (it is not a "mixed changeset" — private packages are versionable, see
above) and to stay limited to exactly those three packages. That would give `livelink.base` a
meaningful version — it is currently frozen at 0.8.64 because no changeset ever names it — and its
own `CHANGELOG.md` carrying the commit subjects. It changes nothing about release *triggering*.
