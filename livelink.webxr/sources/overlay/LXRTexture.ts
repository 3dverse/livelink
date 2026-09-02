//------------------------------------------------------------------------------
/**
 * A canvas-backed texture for {@link LXRQuad}, uploaded to the GPU only when it has changed.
 *
 * Everything an overlay draws — a reticle, a panel, a cursor — is 2D artwork, and Canvas 2D is the
 * one drawing API every browser that can run a WebXR session already has. The canvas is the
 * consumer's to draw into; the GL side of it is entirely here, and the upload happens on the first
 * frame after {@link markDirty}, not on every frame. A panel whose label has not changed costs one
 * `bindTexture` per view.
 *
 * The GL texture is created against whatever context first draws this, so an instance can be built
 * long before a session exists.
 *
 * @experimental
 */
export class LXRTexture {
    /**
     * The canvas holding the artwork. Draw into it through {@link context_2d}.
     */
    readonly #canvas: HTMLCanvasElement;

    /**
     * The 2D context of {@link #canvas}, or null on a user agent that refused one.
     */
    readonly #context_2d: CanvasRenderingContext2D | null;

    /**
     * Whether the canvas has been drawn into since the last upload. Starts true: a texture that was
     * never uploaded has nothing on the GPU to draw.
     */
    #is_dirty: boolean = true;

    /**
     * The context {@link #gl_texture} belongs to. A WebGL texture is not portable between contexts,
     * so this is what recognises one that has to be recreated.
     */
    #gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;

    /**
     * The uploaded texture, created on the first draw.
     */
    #gl_texture: WebGLTexture | null = null;

    /**
     * @param width Width of the backing canvas, in pixels.
     * @param height Height of the backing canvas, in pixels.
     */
    constructor({ width, height }: { width: number; height: number }) {
        this.#canvas = document.createElement("canvas");
        this.#canvas.width = Math.max(1, Math.floor(width));
        this.#canvas.height = Math.max(1, Math.floor(height));

        this.#context_2d = this.#canvas.getContext("2d");
        if (!this.#context_2d) {
            console.error("Could not create the 2D context of an XR overlay texture");
        }
    }

    /**
     * The backing canvas.
     */
    get canvas(): HTMLCanvasElement {
        return this.#canvas;
    }

    /**
     * The 2D context to draw the artwork with, or null on a user agent that refused one — in which
     * case nothing using this texture is drawn.
     *
     * Call {@link markDirty} after drawing, or the change never reaches the GPU.
     */
    get context_2d(): CanvasRenderingContext2D | null {
        return this.#context_2d;
    }

    /**
     * Width of the backing canvas, in pixels.
     */
    get width(): number {
        return this.#canvas.width;
    }

    /**
     * Height of the backing canvas, in pixels.
     */
    get height(): number {
        return this.#canvas.height;
    }

    /**
     * Declare the artwork changed, so the next frame that draws this uploads it.
     */
    markDirty(): void {
        this.#is_dirty = true;
    }

    /**
     * @internal
     *
     * Bind this texture to `TEXTURE_2D` on the active texture unit, creating and uploading it if
     * needed.
     *
     * The upload is premultiplied. The compositor is handed premultiplied colours — see the blend
     * function in {@link LXROverlay} — and premultiplying here rather than in the shader is what
     * makes the *filtering* correct too: interpolating unpremultiplied texels across the edge of
     * a shape blends its colour towards the transparent pixels' undefined colour, which shows up as
     * a dark fringe around everything the overlay draws.
     *
     * @param gl The context to bind into.
     * @returns False when there is nothing to draw with, in which case nothing was bound.
     */
    _bind(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
        if (!this.#context_2d) {
            return false;
        }

        if (this.#gl !== gl) {
            // A different context, which means the previous one is gone: deleting the old texture
            // would need a context that no longer accepts it, so it is simply forgotten.
            this.#gl = gl;
            this.#gl_texture = null;
            this.#is_dirty = true;
        }

        if (!this.#gl_texture) {
            this.#gl_texture = gl.createTexture();
            if (!this.#gl_texture) {
                return false;
            }

            gl.bindTexture(gl.TEXTURE_2D, this.#gl_texture);
            // No mipmap filter and no repeat wrapping, which is what makes an arbitrary,
            // non-power-of-two canvas size legal in WebGL 1.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.#is_dirty = true;
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.#gl_texture);
        }

        if (this.#is_dirty) {
            this.#is_dirty = false;
            // Restored immediately: the same context uploads the streamed frame pixels, which must
            // not be premultiplied on their way in.
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#canvas);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        }

        return true;
    }

    /**
     * Hand the GPU texture back. The canvas survives, so a released texture that is drawn again
     * simply uploads itself once more.
     */
    release(): void {
        if (this.#gl && this.#gl_texture) {
            this.#gl.deleteTexture(this.#gl_texture);
        }
        this.#gl = null;
        this.#gl_texture = null;
        this.#is_dirty = true;
    }
}
