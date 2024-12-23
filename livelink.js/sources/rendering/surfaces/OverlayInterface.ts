/**
 * Interface for rendering overlays.
 *
 * An overlay is a surface that is drawn on top of the main rendering surface, and composited with the frame
 * rendered by the server.
 *
 * @see
 * For a Three.js overlay implementation, see: https://www.npmjs.com/package/@3dverse/livelink-three
 *
 * @category Rendering
 */
export interface OverlayInterface {
    /**
     * Draws the overlay to the output canvas if provided.
     * If no output canvas is provided, the overlay should use its own way to render itself.
     *
     * @param params
     * @param params.output_canvas - The optional canvas to draw the overlay to.
     *
     * @returns The optional canvas containing the overlay.
     */
    draw({ output_canvas }: { output_canvas: OffscreenCanvas | null }): OffscreenCanvas | null;

    /**
     * Resizes the overlay.
     */
    resize({ width, height }: { width: number; height: number }): void;

    /**
     * Releases the resources associated with the overlay.
     */
    release(): void;
}
