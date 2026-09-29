//------------------------------------------------------------------------------
import type { LivelinkCore, UUID } from "@3dverse/livelink.core";
import { DynamicLoader } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { LivelinkBase, type LivelinkProgressCallback, type UpdateLoopRates } from "@livelink.base/LivelinkBase";
import type { Entity } from "@livelink.base/scene/Entity";
import { Scene } from "@livelink.base/scene/Scene";
import { Session, type SessionSelector } from "@livelink.base/session/Session";
import type { SessionInfo } from "@livelink.base/session/SessionInfo";

//------------------------------------------------------------------------------
import { disableInactivityTimeout } from "./inactivity";
import { installGatewaySocketGuard } from "./nodeSocketGuard";

/**
 * The main class for connecting a headless agent to a 3dverse session.
 *
 * Usage:
 * - `Livelink.start()` to create a new session
 * - `Livelink.join()` to join an existing session
 * - `Livelink.join_or_start()` to join or create a session
 *
 * @category Main
 */
export class Livelink extends LivelinkBase<Entity, Scene, Session> {
    /**
     * Creates a new session and connects to it.
     */
    static async start({
        scene_id,
        token,
        is_transient = false,
        session_options,
        onProgress,
    }: {
        scene_id: UUID;
        token: string;
        is_transient?: boolean;
        session_options?: Record<string, boolean>;
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        onProgress?.("creating-session");
        const session = await Session.create({ scene_id, token, is_transient, options: session_options });
        return await Livelink.join({ session, onProgress });
    }

    /**
     * Connects to an existing session matching the given scene ID.
     * If no session is found, a new session is created.
     */
    static async join_or_start({
        scene_id,
        token,
        session_selector = ({ sessions }: { sessions: Array<SessionInfo> }): SessionInfo => sessions[0],
        is_transient = false,
        session_options,
        onProgress,
    }: {
        scene_id: UUID;
        token: string;
        session_selector?: SessionSelector;
        is_transient?: boolean;
        session_options?: Record<string, boolean>;
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        onProgress?.("finding-session");
        const session = await Session.find({ scene_id, token, session_selector });
        if (session === null) {
            return await Livelink.start({ scene_id, token, is_transient, session_options, onProgress });
        }

        try {
            return await Livelink.join({ session, onProgress });
        } catch {
            return await Livelink.join_or_start({
                scene_id,
                token,
                session_selector: ({ sessions }) => {
                    const filtered = sessions.filter(s => s.session_id !== session.session_id);
                    return filtered.length === 0 ? null : session_selector({ sessions: filtered });
                },
                is_transient,
                session_options,
                onProgress,
            });
        }
    }

    /**
     * Connects to an existing session.
     *
     * The session can be provided either as a fully-constructed {@link Session} instance, or as a
     * {@link SessionInfo} along with the authentication token to use against it.
     */
    static async join({
        session,
        onProgress,
    }: {
        session: Session | { session_info: SessionInfo; token: string };
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        onProgress?.("initializing");
        installGatewaySocketGuard();
        await DynamicLoader.load();

        const session_instance = session instanceof Session ? session : Session.createFromInfo(session);

        const livelink = new Livelink({ session: session_instance });
        await livelink._connect({ is_headless: true, onProgress });

        // An agent is never "idle" the way a user is; without this the core drops a connection
        // that has sent nothing but heartbeats for six minutes. See `disableInactivityTimeout`.
        disableInactivityTimeout(livelink.activity_watcher);

        onProgress?.("ready");
        return livelink;
    }

    /**
     * @internal
     */
    protected _createScene({ core }: { core: LivelinkCore }): Scene {
        return new Scene(this, core);
    }

    /**
     * Starts the client update loop.
     *
     * Each rate must be a finite number in the `(0, 125]` range so that the resulting interval is
     * at least 8 milliseconds.
     *
     * @throws RangeError if a rate falls outside the accepted range.
     */
    async startUpdateLoop({ updatesPerSecond, broadcastsPerSecond }: UpdateLoopRates = {}): Promise<void> {
        this._startUpdateLoop({ updatesPerSecond, broadcastsPerSecond });
    }
}
