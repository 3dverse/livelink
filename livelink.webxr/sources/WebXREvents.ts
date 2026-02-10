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

//------------------------------------------------------------------------------
/**
 * Events emitted by WebXRHelper.
 */
export type WebXREvents = {
    "on-viewport-updated": ViewportUpdatedEvent;
};
