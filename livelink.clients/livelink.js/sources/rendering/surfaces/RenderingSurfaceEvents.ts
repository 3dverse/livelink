/**
 * An event that is fired when a rendering surface is resized.
 *
 * Dispatched by {@link RenderingSurfaceBase} — and so by {@link RenderingSurface} and
 * {@link OffscreenSurface} — as `on-rendering-surface-resized`.
 *
 * @event
 * @noInheritDoc
 * @category Rendering Surfaces / Events
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
 * The events dispatched by {@link RenderingSurfaceBase}.
 *
 * @event
 * @category Rendering Surfaces / Events
 */
export type RenderingSurfaceEvents = {
    "on-rendering-surface-resized": RenderingSurfaceResizedEvent;
};
