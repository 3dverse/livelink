# Release triggering for livelink.base changes: options and open questions

`livelink.base` is `"private": true` and is consumed as a **source folder via a build alias**
(`@livelink.base/*`), not as an npm dependency of `@3dverse/livelink` or
`@3dverse/livelink-agent` — neither package lists it in `dependencies`/`devDependencies`. Because
Changesets' version-bump cascade (`updateInternalDependencies` +
`___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents` in
[../../.changeset/config.json](../../.changeset/config.json)) only walks the `package.json`
dependency graph, a `livelink.base`-only change produces no changeset for the published packages
by default.

## Current approach (in production)

`.gitlab-ci.yml`'s `version:update-version` job detects `git diff`s touching
`livelink.clients/livelink.base/` and hand-writes a `.changeset/base-release.md` naming
`@3dverse/livelink` and `@3dverse/livelink-agent` directly with a patch bump. This works, but it's
a bespoke script that has to hardcode the consumer package list and re-implement (in bash) a
smaller version of what Changesets' own dependency graph already does for every other package pair
in this repo (e.g. `livelink.react` → `livelink`).

## Alternative considered: wire livelink.base into the real Changesets graph

Add `"@3dverse/livelink-base": "workspace:*"` as a `devDependency` of `livelink.js` and
`livelink.agent`. In principle this lets the existing `updateInternalDependents: "always"` config
(already doing this job for `livelink.react`, `livelink.three`, `livelink.webxr`,
`livelink.react.ui`) cascade a patch bump automatically once `livelink.base` itself has a
changeset — shrinking the CI script to "detect a change → write one changeset naming only
`@3dverse/livelink-base`", with Changesets handling the rest (including proper changelog entries
mentioning the bumped dependency, instead of hand-written boilerplate text).

This has **not** been implemented or tested. Two things block it:

1. **Unverified: does the cascade fire for a private, unversioned package?** Changesets'
   `privatePackages.version` defaults to `false` — a private package's own version is not bumped
   by default. Whether `updateInternalDependents` still cascades a bump to dependents when the
   upstream package is private and excluded from versioning isn't documented with certainty
   (the option itself is flagged experimental / "WILL_CHANGE_IN_PATCH" by Changesets). It may also
   require `privatePackages: { "version": true }` to work at all, which would start writing (and
   presumably committing) version bumps to `livelink.base/package.json` too.
2. **Unverified: can `changesets-tools generate-changesets` emit a changeset for `livelink.base`?**
   The changeset naming `@3dverse/livelink-base` still has to come from somewhere. Today's
   `changesets-tools` (a private binary from `registry.gitlab.com/3dverse/platform/ci-utils`, not
   vendored in this repo) generated `Generated changesets : []` for a
   `feat(livelink.base): ...` commit — consistent with it not mapping `livelink.base` commits to a
   package today. If it can't be taught to do so, the CI script would still be needed, just to
   write a changeset naming `@3dverse/livelink-base` alone instead of the two consumer packages.

## How to test this, if picked up later

Do this in a scratch git worktree — never in the real working tree, since it involves running
`@changesets/cli version`, which mutates `package.json`/`CHANGELOG.md`/the lockfile in place:

1. `git worktree add <scratch-dir>` off the branch you want to test from.
2. In the worktree, add `"@3dverse/livelink-base": "workspace:*"` as a `devDependency` to
   `livelink.clients/livelink.js/package.json` and `livelink.clients/livelink.agent/package.json`,
   then `npm install` so the workspace/lockfile is consistent.
3. Hand-write `.changeset/test-base-cascade.md` naming **only** `'@3dverse/livelink-base': patch`
   (do not name `livelink`/`livelink-agent` — the point is to see if they get pulled in on their
   own).
4. Run `npx @changesets/cli status --verbose` (non-mutating) to see the computed release plan, then
   `npx @changesets/cli version` and check:
   - Did `@3dverse/livelink` and `@3dverse/livelink-agent`'s versions bump?
   - Did `@3dverse/livelink-base`'s own version change (expected: no, by default)?
   - Are the generated CHANGELOG entries for the two public packages sensible?
5. If no cascade happens, retry with `"privatePackages": { "version": true }` added to
   `.changeset/config.json` in the worktree.
6. Record the outcome here (or wherever this doc lands next), then `git worktree remove` the
   scratch dir — nothing from this experiment is meant to land as-is.

**If the cascade works:** simplify `version:update-version` in `.gitlab-ci.yml` to only synthesize
a changeset naming `@3dverse/livelink-base`, and add the `devDependency` edges for real. Whether
`changesets-tools generate-changesets` can be taught to do this natively is a separate question for
whoever owns that tool.

**If the cascade doesn't work:** the current CI-heuristic approach (hardcoding the consumer
package list) is confirmed as the correct approach given this repo's architecture — no further
action needed, and this alternative doesn't need to be re-investigated from scratch later.
