/**
 * An event that is fired when a rendering surface is resized.
 *
 * @event
 * @noInheritDoc
 * @category Rendering
 */
export class RenderingSurfaceResizedEvent extends Event {
    /**
     * @internal
     */
    constructor() {
        super("on-rendering-surface-resized");
    }
}

/**
 * @event
 * @category Rendering
 */
export type RenderingSurfaceEvents = {
    "on-rendering-surface-resized": RenderingSurfaceResizedEvent;
};
