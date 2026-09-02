//------------------------------------------------------------------------------
import type { LXRTexture } from "./LXRTexture";

//------------------------------------------------------------------------------
/**
 * Column-major identity, the pose a quad starts at.
 */
const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

//------------------------------------------------------------------------------
/**
 * A textured rectangle drawn into the XR framebuffer, in the session's reference space.
 *
 * This is the only way to put something in front of a user wearing a headset. `dom-overlay` is an
 * optional feature no headset browser grants, so nothing in the DOM — not a React HUD, not a
 * placement reticle — is composited in an immersive session, in AR passthrough as much as in VR.
 * A quad is composited, because it is drawn into the same framebuffer as the streamed image.
 *
 * The pose is a full {@link matrix} rather than a position and an orientation: what a quad has to
 * line up with is usually already a matrix — a hit test pose, a grip pose, a view — and decomposing
 * one only to recompose it loses precision for nothing.
 *
 * @experimental
 */
export class LXRQuad {
    /**
     * Quad space → reference space, column-major, as WebXR hands its matrices out.
     *
     * Quad space is the plane the artwork sits in: `x` to its right, `y` up, and `+z` the side it
     * is seen from, spanning `[-0.5, 0.5]` in both axes before {@link width} and {@link height}
     * scale it. Write into it in place — `quad.matrix.set(pose.transform.matrix)` — rather than
     * replacing it, so nothing has to be told the array changed.
     */
    readonly matrix: Float32Array = new Float32Array(IDENTITY_MATRIX);

    /**
     * Width in metres, in the reference space {@link matrix} lands the quad in. Real-world metres,
     * unaffected by the camera rig scale: this is drawn where the user is, not where the scene is.
     */
    width: number = 1;

    /**
     * Height in metres. See {@link width}.
     */
    height: number = 1;

    /**
     * Overall transparency, from 0 to 1, multiplied into whatever the texture already carries.
     */
    opacity: number = 1;

    /**
     * Whether the quad is drawn at all. A quad with nothing truthful to show — a reticle on a frame
     * with no surface — should be hidden rather than left at the last pose it had.
     */
    visible: boolean = true;

    /**
     * Draw order, lowest first. There is no depth test — UI the streamed image can occlude is
     * unusable — so this is the whole of what decides which of two overlapping quads is on top.
     */
    z_order: number = 0;

    /**
     * The artwork. A quad with no texture draws nothing.
     */
    texture: LXRTexture | null = null;

    /**
     * @param texture The artwork to draw.
     * @param width Width in metres.
     * @param height Height in metres.
     * @param z_order Draw order, lowest first.
     */
    constructor({
        texture,
        width,
        height,
        z_order,
    }: { texture?: LXRTexture; width?: number; height?: number; z_order?: number } = {}) {
        this.texture = texture ?? null;
        if (width !== undefined) {
            this.width = width;
        }
        if (height !== undefined) {
            this.height = height;
        }
        if (z_order !== undefined) {
            this.z_order = z_order;
        }
    }

    /**
     * Whether this quad has anything to draw on this frame.
     */
    get is_drawable(): boolean {
        return this.visible && this.opacity > 0 && this.texture !== null && this.width > 0 && this.height > 0;
    }
}
