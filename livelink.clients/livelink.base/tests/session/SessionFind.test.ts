import { afterEach, describe, expect, it, vi } from "vitest";

import type { UUID } from "@3dverse/livelink.core";
import { Session } from "../../sources/session/Session";
import type { SessionInfo } from "../../sources/session/SessionInfo";

//------------------------------------------------------------------------------
const SCENE_ID = "00000000-0000-0000-0000-00000000cafe" as UUID;
const TOKEN = "test-token";

function makeSessionInfo({ session_id }: { session_id: UUID }): SessionInfo {
    return { session_id, scene_id: SCENE_ID, is_transient_session: false };
}

function stubFetchResponse({ ok, status, body }: { ok: boolean; status: number; body?: unknown }): void {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok, status, json: async () => body })),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

//------------------------------------------------------------------------------
// `Session.find` resolves to null when no session matched. A non-OK response to
// the session-list request is a legitimate impossibility to list the sessions
// of the scene (same contract as the pre-split SDK): `list` resolves to an
// empty list and `find` to null. Only transport-level failures reject.
//------------------------------------------------------------------------------
describe("Session.find", () => {
    it("rejects when the session list request fails at the transport level", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new TypeError("network down");
            }),
        );

        await expect(
            Session.find({ scene_id: SCENE_ID, token: TOKEN, session_selector: ({ sessions }) => sessions[0] }),
        ).rejects.toThrow("network down");
    });

    it("resolves to null when the session list request fails with an HTTP error", async () => {
        stubFetchResponse({ ok: false, status: 503 });

        const session = await Session.find({
            scene_id: SCENE_ID,
            token: TOKEN,
            session_selector: ({ sessions }) => sessions[0],
        });

        expect(session).toBeNull();
    });

    it("resolves to null when no session is running the scene", async () => {
        stubFetchResponse({ ok: true, status: 200, body: [] });

        const session = await Session.find({
            scene_id: SCENE_ID,
            token: TOKEN,
            session_selector: ({ sessions }) => sessions[0],
        });

        expect(session).toBeNull();
    });

    it("resolves to null when the selector selects no session", async () => {
        stubFetchResponse({ ok: true, status: 200, body: [makeSessionInfo({ session_id: "s1" as UUID })] });

        const session = await Session.find({
            scene_id: SCENE_ID,
            token: TOKEN,
            session_selector: () => null,
        });

        expect(session).toBeNull();
    });

    it("resolves to the selected session", async () => {
        stubFetchResponse({
            ok: true,
            status: 200,
            body: [makeSessionInfo({ session_id: "s1" as UUID }), makeSessionInfo({ session_id: "s2" as UUID })],
        });

        const session = await Session.find({
            scene_id: SCENE_ID,
            token: TOKEN,
            session_selector: ({ sessions }) => sessions[1],
        });

        expect(session).not.toBeNull();
        expect(session!.session_id).toBe("s2");
        expect(session!.has_been_created).toBe(false);
    });
});
