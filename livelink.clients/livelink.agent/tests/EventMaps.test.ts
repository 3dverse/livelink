import { describe, expect, it } from "vitest";

import type { AgentEvents } from "../sources/AgentEvents";
import type { SceneIngestionEvents } from "../sources/data/SceneIngestionEvents";

/**
 * `SceneIngestionEvents` re-emits the agent's session lifecycle and is declared key by key rather
 * than as `Omit<AgentEvents, "on-error"> & { … }`, so that TypeDoc documents every entry instead of
 * only the literal half of an intersection. The cost is duplication: a new agent event would
 * silently be missing here.
 *
 * This assertion is the guard. It has no runtime effect — it fails at *typecheck* time
 * (`npm run typecheck`), which is exactly when the drift is introduced.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/** The ingestion map must mirror the agent's, apart from the entries it owns or overrides. */
export const ingestion_events_parity: MutuallyAssignable<
    Omit<SceneIngestionEvents, "on-running" | "on-session-bound" | "on-session-unbound" | "on-error">,
    Omit<AgentEvents, "on-error">
> = true;

describe("SceneIngestionEvents", () => {
    it("mirrors the agent's session events (enforced at typecheck time)", () => {
        expect(ingestion_events_parity).toBe(true);
    });
});
