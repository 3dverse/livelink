import { describe, expect, it } from "vitest";

import type { Client } from "../sources/session/Client";
import type { Entity } from "../sources/scene/Entity";
import type { SceneEvents } from "../sources/scene/SceneEvents";
import type { SessionEvents } from "../sources/session/SessionEvents";
import type { SceneEvents as SceneEventsBase } from "@livelink.base/scene/SceneEvents";
import type { SessionEvents as SessionEventsBase } from "@livelink.base/session/SessionEvents";

/**
 * The browser event maps are declared key by key instead of aliasing the shared ones, so that every
 * entry points at the flavour the browser SDK publishes and TypeDoc documents them all (an alias
 * renders as an opaque reference, an intersection expands only its literal half). The cost is
 * duplication: a new shared event would silently be missing from the browser map.
 *
 * These assertions are the guard. They have no runtime effect — they fail at *typecheck* time
 * (`npm run typecheck`, which spans this file through `tsconfig.test.json`), which is exactly when
 * the drift is introduced.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/** The browser scene map adds nothing: it must match the shared one exactly. */
export const scene_events_parity: MutuallyAssignable<SceneEvents<Entity>, SceneEventsBase<Entity>> = true;

/** The browser session map adds the deprecated viewport event, and must match otherwise. */
export const session_events_parity: MutuallyAssignable<
    Omit<SessionEvents<Client>, "TO_REMOVE__viewports-added">,
    SessionEventsBase<Client>
> = true;

describe("browser event maps", () => {
    it("mirror the shared ones (enforced at typecheck time)", () => {
        expect(scene_events_parity && session_events_parity).toBe(true);
    });
});
