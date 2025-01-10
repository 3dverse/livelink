//------------------------------------------------------------------------------
import type { Quat, Vec3 } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { mat4, quat, vec2, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import { ContextProvider } from "./ContextProvider";
import type { FrameMetaData } from "../decoders/FrameMetaData";

/**
 *
 */
type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 *
 */
export class XRContext extends ContextProvider {
    /**
     *
     */
    #context: WebGLRenderingContext | WebGL2RenderingContext;

    /**
     * The WebGLRenderingContext of the canvas
     */
    #texture_ref: WebGLTexture | null = null;

    /**
     * The WebGLRenderingContext of the canvas
     */
    #shader_program: WebGLProgram | null = null;

    /**
     * The alternative frame buffer to draw on.
     */
    #frame_buffer: WebGLFramebuffer | null = null;

    /**
     *
     */
    #last_frame: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData } | null = null;

    /**
     *
     */
    screen_distance: number = 25;

    /**
     *
     */
    scale_factor: number = 1;

    /**
     *
     */
    fake_alpha_enabled: boolean = false;

    /**
     *
     */
    readonly #neutral_direction: vec3 = vec3.fromValues(0, 0, -1);

    /**
     *
     */
    #billboard_position: vec3 = vec3.create();
    #billboard_model_matrix: mat4 = mat4.create();
    #projection_offset: vec2 = vec2.create();

    /**
     *
     */
    #camera_position: vec3 = vec3.create();
    #camera_orientation: quat = quat.create();
    #camera_direction: vec3 = vec3.create();

    /**
     *
     */
    get native(): WebGLRenderingContext | WebGL2RenderingContext {
        return this.#context;
    }

    /**
     *
     */
    set frame_buffer(fb: WebGLFramebuffer) {
        this.#frame_buffer = fb;
    }

    /**
     *
     */
    constructor(
        canvas: Canvas,
        context_type: "webgl" | "webgl2" = "webgl",
        context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean },
    ) {
        super();

        const context = canvas.getContext(context_type, context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a ${context_type} context from canvas`);
        }

        this.#context =
            context_type === "webgl" ? (context as WebGLRenderingContext) : (context as WebGL2RenderingContext);

        this.#initShaderProgram();
        this.#initBuffers();
        this.#initTexture();
    }

    /**
     *
     */
    drawFrame(frame: {
        frame: VideoFrame | OffscreenCanvas;
        left: number;
        top: number;
        meta_data: FrameMetaData;
    }): void {
        this.#last_frame = frame;
    }

    /**
     *
     */
    get meta_data(): FrameMetaData | null {
        return this.#last_frame?.meta_data || null;
    }

    /**
     *
     */
    drawXRFrame({
        xr_views,
    }: {
        xr_views: Array<{
            view: XRView;
            viewport: XRViewport;
            frame_camera_transform: {
                position: Vec3;
                orientation: Quat;
            };
        }>;
    }): void {
        if (!this.#last_frame) {
            return;
        }

        const gl = this.#context;

        if (this.#frame_buffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.#frame_buffer);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const sizeLocation = gl.getUniformLocation(this.#shader_program!, "size");
        const offsetLocation = gl.getUniformLocation(this.#shader_program!, "offset");
        const viewMatrixLocation = gl.getUniformLocation(this.#shader_program!, "viewMatrix");
        const viewOffsetLocation = gl.getUniformLocation(this.#shader_program!, "viewOffset");

        const projectionMatrixLocation = gl.getUniformLocation(this.#shader_program!, "projectionMatrix");
        const billboardMatrixLocation = gl.getUniformLocation(this.#shader_program!, "billboardMatrix");
        const fakeAlphaEnabledLocation = gl.getUniformLocation(this.#shader_program!, "fakeAlphaEnabled");

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#last_frame.frame);

        const fovY = Math.atan(1 / xr_views[0].view.projectionMatrix[5]) * 2;

        const aspectRatio = xr_views[0].viewport.width / xr_views[0].viewport.height;
        const scaleY = this.scale_factor * this.screen_distance * Math.tan(fovY * 0.5);
        const scaleX = scaleY * aspectRatio;

        const viewportWidth = 1 / xr_views.length;
        const viewportHeight = 1;

        gl.uniform2fv(sizeLocation, [viewportWidth, viewportHeight]);

        const combinedViewportWidth = xr_views.reduce((acc, { viewport }) => acc + viewport.width, 0);

        for (const { view, viewport, frame_camera_transform } of xr_views) {
            vec3.set(
                this.#camera_position,
                frame_camera_transform.position[0],
                frame_camera_transform.position[1],
                frame_camera_transform.position[2],
            );

            quat.set(
                this.#camera_orientation,
                frame_camera_transform.orientation[0],
                frame_camera_transform.orientation[1],
                frame_camera_transform.orientation[2],
                frame_camera_transform.orientation[3],
            );

            // Compute the billboard position from the camera position and orientation
            vec3.transformQuat(this.#camera_direction, this.#neutral_direction, this.#camera_orientation);
            vec3.scaleAndAdd(
                this.#billboard_position,
                this.#camera_position,
                this.#camera_direction,
                this.screen_distance,
            );

            this.#projection_offset[0] = view.projectionMatrix[8];
            this.#projection_offset[1] = view.projectionMatrix[9];

            const billboardMatrix = this.#computeBillboardMatrix(this.#billboard_position, scaleX, scaleY);
            gl.uniform2fv(viewOffsetLocation, this.#projection_offset);

            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            gl.uniformMatrix4fv(viewMatrixLocation, false, view.transform.inverse.matrix);
            gl.uniformMatrix4fv(projectionMatrixLocation, false, view.projectionMatrix);
            gl.uniformMatrix4fv(billboardMatrixLocation, false, billboardMatrix);
            gl.uniform1i(fakeAlphaEnabledLocation, this.fake_alpha_enabled ? 1 : 0);

            const frame_offset = viewport.x / combinedViewportWidth;
            gl.uniform2fv(offsetLocation, [frame_offset, 0]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    }

    /**
     *
     */
    refreshSize(): void {}

    /**
     *
     */
    release(): void {
        const gl = this.#context;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     *
     */
    #computeBillboardMatrix(billboard_position: vec3, scaleX: number, scaleY: number): Float32Array {
        mat4.fromRotationTranslationScale(
            this.#billboard_model_matrix,
            this.#camera_orientation,
            billboard_position,
            vec3.fromValues(scaleX, scaleY, 1),
        );

        return this.#billboard_model_matrix as Float32Array;
    }

    /**
     *
     */
    #initShaderProgram(): void {
        const gl = this.#context!;
        // Vertex shader
        const vertex_shader_source = `
            attribute vec2 position;
            varying vec2 texCoord;

            uniform mat4 viewMatrix;
            uniform mat4 projectionMatrix;
            uniform vec2 scale;
            uniform mat4 billboardMatrix;

            uniform vec2 size;
            uniform vec2 offset;
            uniform vec2 viewOffset;

            void main() {
                texCoord = (position + 1.0) * 0.5;
                texCoord.y = 1.0 - texCoord.y;
                texCoord = size * texCoord + offset;
                gl_Position = projectionMatrix * viewMatrix * billboardMatrix * vec4(position + viewOffset, 0.0, 1.0);
            }`;
        const vertex_shader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertex_shader, vertex_shader_source);
        gl.compileShader(vertex_shader);
        if (!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)) {
            console.error("Vertex shader failed to compile: " + gl.getShaderInfoLog(vertex_shader));
        }

        // Fragment shader
        const fragment_shader_source = `
            precision mediump float;
            varying vec2 texCoord;
            uniform sampler2D texture;
            uniform int fakeAlphaEnabled;

            float tanh(float x) {
                float ex = exp(x);
                float eNegx = exp(-x);
                return (ex - eNegx) / (ex + eNegx);
            }
            void main() {
                gl_FragColor = texture2D(texture, texCoord);
                if(fakeAlphaEnabled == 1) {
                    highp float maxIntensity = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);

                    // basic threshold
                    if(maxIntensity < 0.1) {
                        gl_FragColor.a = maxIntensity;
                    }

                    // sigmoid
                    // if(maxIntensity < 0.1) {
                    //     float k = 100.0; // Increased steepness for faster fade near black
                    //     float x0 = 0.02; // Lower midpoint to handle darker edges with illumination
                    //     gl_FragColor.a = 1.0 / (1.0 + exp(-k * (maxIntensity - x0)));
                    // }

                    // Hyperbolic Tangent
                    if(maxIntensity < 0.1) {
                        // float k = 100.0;
                        // float x0 = 0.005;
                        float k = 80.0;
                        float x0 = 0.01;
                        gl_FragColor.a = max(0.0, tanh(k * (maxIntensity - x0)));
                    }
                }
            }`;
        const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragment_shader, fragment_shader_source);
        gl.compileShader(fragment_shader);
        if (!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)) {
            console.error("Fragment shader failed to compile: " + gl.getShaderInfoLog(fragment_shader));
        }

        // Shader program
        const shader_program = gl.createProgram()!;
        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);
        gl.linkProgram(shader_program);
        gl.useProgram(shader_program);
        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.error("Program failed to compile: " + gl.getProgramInfoLog(shader_program));
        }
        gl.useProgram(shader_program);
        this.#shader_program = shader_program;
    }

    /**
     *
     */
    #initBuffers(): void {
        const gl = this.#context!;

        const vertex_buffer = gl.createBuffer();
        const vertices = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const position_attribute_location = gl.getAttribLocation(this.#shader_program!, "position");
        gl.enableVertexAttribArray(position_attribute_location);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     *
     */
    #initTexture(): void {
        const gl = this.#context!;
        this.#texture_ref = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const texture_uniform_location = gl.getUniformLocation(this.#shader_program!, "texture");
        gl.uniform1i(texture_uniform_location, 0);
    }
}
