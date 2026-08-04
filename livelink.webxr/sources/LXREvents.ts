//------------------------------------------------------------------------------
import type { Viewport } from "@3dverse/livelink";

/**
 * Event emitted when the WebXR rendering surface is resized.
 */
export class ViewportUpdatedEvent extends Event {
    constructor({ viewport }: { viewport: Viewport }) {
        super("on-viewport-updated");
        this.viewport = viewport;
    }

    readonly viewport: Viewport;
}

/**
 * Event emitted when the underlying XRSession ended on its own — headset system menu, Android
 * back gesture, doff timeout, or a UA-side failure.
 *
 * Ends caused by {@link XRLivelink.release} are deliberately *not* reported: a consumer that
 * resets its XR mode on this event would otherwise tear itself down while switching between AR
 * and VR, which ends the current session before opening the next one.
 */
export class SessionEndEvent extends Event {
    constructor({ xr_session_event }: { xr_session_event: XRSessionEvent }) {
        super("on-session-end");
        this.xr_session_event = xr_session_event;
    }

    /**
     * The native `end` event dispatched by the XRSession.
     */
    readonly xr_session_event: XRSessionEvent;
}

/**
 * Events emitted by XRLivelink.
 */
export type LXREvents = {
    "on-viewport-updated": ViewportUpdatedEvent;
    "on-session-end": SessionEndEvent;
};
