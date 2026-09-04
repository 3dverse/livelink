//------------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import type { LXRLaunchState, LXRLauncher } from "../launch/LXRLauncher";

//------------------------------------------------------------------------------
/**
 * What {@link useXRLaunch} hands a button.
 */
export type XRLaunchStatus = {
    /**
     * The launcher's verdict, or null while it is still being worked out. Everything below is
     * derived from it; read it directly to build something other than a button.
     */
    state: LXRLaunchState | null;

    /**
     * Whether the verdict is still pending. True on the first render, and again whenever the mode
     * or the launcher changes.
     */
    isResolving: boolean;

    /**
     * Whether {@link XRLaunchStatus.launch} would do anything — the session can be entered here, or
     * a launch can be triggered.
     */
    canLaunch: boolean;

    /**
     * Whether acting will navigate away from this page rather than enter a session in it. Worth
     * surfacing: the user is about to leave, and on iOS they may be prompted to install a clip.
     */
    willRedirect: boolean;

    /**
     * Ready-to-display label explaining the current state.
     */
    message: string;

    /**
     * Enter the session, or navigate to the launcher — whichever this state calls for. A no-op when
     * {@link XRLaunchStatus.canLaunch} is false.
     */
    launch: () => void;
};

//------------------------------------------------------------------------------
/**
 * Turn a {@link LXRLauncher} verdict into the state a button needs.
 *
 * This is the whole of "can I enter XR here, and what do I do about it" — including the iOS case,
 * where the answer is to navigate to an App Clip and come back. A consumer wires in a launcher and
 * renders the result; it never has to know which platform it is on, because a launcher on a
 * platform with real WebXR support reports `supported` and does nothing.
 *
 * The verdict is recomputed when `mode` or `launcher` changes, so a launcher built inline in a
 * render should be memoized — otherwise every render re-resolves, and with
 * {@link LXRVariantLaunchLauncher} that means re-running an SDK handshake.
 *
 * @param mode The session mode the button will request.
 * @param launcher The strategy to resolve with. Undefined leaves the hook idle and reporting
 * `no launcher configured`, which is the sensible state for a build with no iOS support wired up.
 * @param onEnter Called instead of navigating when the session can be entered from this page. This
 * is where a consumer flips its own "we are in XR now" state, the way the sample sets its XR mode.
 *
 * @example
 * ```tsx
 * const launcher = useMemo(() => new LXRAppClipLauncher({ domain }), [domain]);
 * const { canLaunch, message, launch } = useXRLaunch({
 *     mode: "immersive-ar",
 *     launcher,
 *     onEnter: () => setXRMode("immersive-ar"),
 * });
 *
 * return <button onClick={launch} disabled={!canLaunch}>{message}</button>;
 * ```
 */
export function useXRLaunch({
    mode,
    launcher,
    onEnter,
}: {
    mode: XRSessionMode;
    launcher?: LXRLauncher;
    onEnter?: (mode: XRSessionMode) => void;
}): XRLaunchStatus {
    //--------------------------------------------------------------------------
    const [state, setState] = useState<LXRLaunchState | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        setState(null);

        if (!launcher) {
            setState({
                status: "unsupported",
                reason: "needs-launcher",
                message: "No XR launcher is configured.",
            });
            return;
        }

        const abort_controller = new AbortController();
        const { signal } = abort_controller;

        launcher
            .resolve({ mode, signal })
            .then(resolved => {
                if (!signal.aborted) {
                    setState(resolved);
                }
            })
            .catch(error => {
                if (signal.aborted) {
                    return;
                }

                console.error(`[${launcher.name}] Failed to resolve XR launch state`, error);
                setState({
                    status: "unsupported",
                    reason: "no-webxr",
                    message: "Failed to determine XR support.",
                });
            });

        return (): void => abort_controller.abort();
    }, [mode, launcher]);

    //--------------------------------------------------------------------------
    const launch = useCallback(() => {
        if (!state) {
            return;
        }

        if (state.status === "supported") {
            onEnter?.(mode);
            return;
        }

        if (state.status === "launch-required") {
            window.location.href = state.launch_url;
        }
    }, [state, mode, onEnter]);

    //--------------------------------------------------------------------------
    return useMemo(() => {
        const mode_title = mode.replace("immersive-", "").toUpperCase();

        return {
            state,
            isResolving: state === null,
            canLaunch: state?.status === "supported" || state?.status === "launch-required",
            willRedirect: state?.status === "launch-required",
            message: describe({ state, mode_title }),
            launch,
        };
    }, [state, mode, launch]);
}

//------------------------------------------------------------------------------
/**
 * The label for a state. Split out so {@link useXRLaunch} reads as the state machine it is.
 */
function describe({ state, mode_title }: { state: LXRLaunchState | null; mode_title: string }): string {
    if (state === null) {
        return `Checking ${mode_title} support…`;
    }

    if (state.status === "supported") {
        return `Enter ${mode_title}`;
    }

    if (state.status === "launch-required") {
        // The launch URL is perfectly loadable in Chrome or an in-app browser; it just resolves to
        // an ordinary web page there, because only Safari renders an App Clip card. Saying so up
        // front beats letting the user tap and land nowhere.
        return state.needs_safari ? `Open in Safari to enter ${mode_title}` : `Enter ${mode_title}`;
    }

    return state.reason === "no-webxr" ? `${mode_title} is not supported.` : state.message;
}
