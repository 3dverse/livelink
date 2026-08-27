//------------------------------------------------------------------------------
import { Quaternion, Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
import {
    type RenderGraphDataObject,
    type Livelink,
    type Components,
    type Entity,
    type Vec3,
    type Quat,
    CameraProjection,
    RelativeRect,
    Viewport,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LXRSurface } from "./LXRSurface";

//------------------------------------------------------------------------------
/**
 * LXRViewport represents a viewport for a specific XRView and manages the
 * corresponding livelink viewport and camera entity.
 *
 * @experimental
 */
export class LXRViewport {
    /**
     * Livelink instance reference.
     */
    readonly #livelink: Livelink;

    /**
     * The Eye of the XR view associated with this viewport.
     */
    readonly #xr_view_eye: XREye;

    /**
     * The recommended viewport scale for the XR view if provided by the device. Can be used to optimize rendering
     * performance and quality by adjusting the resolution of the viewport according to the device's capabilities.
     */
    readonly #xr_recommended_viewport_scale?: number;

    /**
     * The XR viewport obtained from the XRWebGLLayer. Not fixed for the lifetime of the session:
     * see {@link syncViewportRect}.
     */
    #xr_viewport: XRViewport;

    /**
     * The livelink viewport corresponding to the XR view.
     */
    readonly viewport: Viewport;

    /**
     * Scratch transform returned by {@link getCameraRemoteTransform}, refilled rather than rebuilt
     * on every frame. One per viewport, so the two eyes never share one; the caller reads it within
     * the frame — the camera rig reverses it in place and the draw consumes it synchronously — and
     * an object plus two arrays per eye per frame is a steady stream of garbage at display rate.
     */
    readonly #remote_transform_scratch: { position: Vec3; orientation: Quat } = {
        position: [0, 0, 0],
        orientation: [0, 0, 0, 1],
    };


    /**
     * The XR viewport this eye is currently rendered into, in XRWebGLLayer framebuffer coordinates.
     */
    get xr_viewport(): XRViewport {
        return this.#xr_viewport;
    }
    
    /**
     * Creates a new LXRViewport instance for a given XRView and rendering surface. This method initializes the
     * LXRViewport by creating a corresponding camera entity with the appropriate perspective lens.
     *
     * @param livelink The Livelink instance to which this viewport belongs.
     * @param xr_view The XR view for which to create the viewport.
     * @param rendering_surface The rendering surface on which the viewport will be created.
     * @param perspective_lens The perspective lens to use for the camera projection.
     * @param is_ar Whether the session is immersive AR, which determines the camera dataJSON configuration.
     * @returns A promise that resolves to a new instance of LXRViewport.
     */
    public static async create({
        livelink,
        xr_view,
        rendering_surface,
        perspective_lens,
        is_ar,
    }: {
        livelink: Livelink;
        xr_view: XRView;
        rendering_surface: LXRSurface;
        perspective_lens: Components.PerspectiveLens;
        is_ar: boolean;
    }): Promise<LXRViewport> {
        const lxrv = new LXRViewport({
            livelink,
            xr_view,
            rendering_surface,
        });

        await lxrv.createCamera({
            perspective_lens,
            dataJSON: is_ar
                ? ({
                      grid: false,
                      displayBackground: false,
                  } as RenderGraphDataObject)
                : undefined,
        });

        return lxrv;
    }
    /**
     * Initializes a new instance of the LXRViewport class.
     *
     * @param livelink The Livelink instance to which this viewport belongs.
     * @param xr_view The XR view for which to create the viewport.
     * @param rendering_surface The rendering surface on which the viewport will be created.
     * @returns A new instance of LXRViewport.
     */
    constructor({
        livelink,
        xr_view,
        rendering_surface,
    }: {
        livelink: Livelink;
        xr_view: XRView;
        rendering_surface: LXRSurface;
    }) {
        console.debug("XR views", xr_view);
        this.#livelink = livelink;
        this.#xr_view_eye = xr_view.eye;

        //  Get XRWebGLLayer from rendering surface
        const xr_base_gl_layer = rendering_surface.xr_base_gl_layer;
        if (!xr_base_gl_layer) {
            throw new Error("XRWebGLLayer is not initialized on the rendering surface. Cannot create LXRViewport.");
        }

        // Request recommended viewport scale if available
        if (xr_view.recommendedViewportScale) {
            console.debug(
                `Requesting recommended viewport scale for ${xr_view.eye} eye:`,
                xr_view.recommendedViewportScale,
            );
            xr_view.requestViewportScale(xr_view.recommendedViewportScale);
            this.#xr_recommended_viewport_scale = xr_view.recommendedViewportScale;
        }

        // Get XR viewport
        const xrv = xr_base_gl_layer.getViewport(xr_view);
        if (!xrv) {
            throw new Error(
                "XRViewport could not be obtained from the XRWebGLLayer. This may indicate an issue with the XR session or device.",
            );
        }
        this.#xr_viewport = { x: xrv.x, y: xrv.y, width: xrv.width, height: xrv.height };

        // Compute relative rect (normalized coordinates)
        const rect = this.#computeRelativeRect({ xr_viewport: xrv, gl_layer: xr_base_gl_layer });
        console.debug(`Viewport rect for ${xr_view.eye} eye:`, rect);

        // Create livelink viewport
        this.viewport = new Viewport({
            core: this.#livelink,
            rendering_surface,
            options: { rect },
        });
    }

    /**
     * Computes the livelink viewport rect from an XR viewport, normalized against the XRWebGLLayer
     * framebuffer. Some user agents already hand back normalized coordinates, which are used as-is.
     *
     * @param xr_viewport The XR viewport to normalize.
     * @param gl_layer The XRWebGLLayer the XR viewport belongs to, providing the framebuffer dimensions.
     * @returns The corresponding relative rect for the livelink viewport.
     */
    #computeRelativeRect({ xr_viewport, gl_layer }: { xr_viewport: XRViewport; gl_layer: XRWebGLLayer }): RelativeRect {
        const { x: left, y: top, width, height } = xr_viewport;

        // Determine if XR viewports are normalized (0-1 range)
        const is_xr_viewport_normalized = left <= 1 && top <= 1 && width <= 1 && height <= 1;

        const { framebufferWidth, framebufferHeight } = gl_layer;
        return new RelativeRect(
            is_xr_viewport_normalized
                ? { left, top, width, height }
                : {
                      left: left / framebufferWidth,
                      top: top / framebufferHeight,
                      width: width / framebufferWidth,
                      height: height / framebufferHeight,
                  },
        );
    }

    /**
     * Reconciles this viewport with the XRWebGLLayer's viewport for the given XR view, as it stands
     * on the current frame.
     *
     * A changed rect is a reconfiguration, not a failure. The user agent may hand back a different
     * viewport on any frame — dynamic viewport scaling, which this class opts into in its
     * constructor through `requestViewportScale`, is exactly that mechanism, and thermal throttling
     * on a standalone headset triggers it routinely. So the cached XR viewport and the livelink
     * viewport's relative rect are both recomputed, and the caller is told so it can notify
     * consumers.
     *
     * @param xr_view The XR view to reconcile against.
     * @param gl_layer The XRWebGLLayer from which to obtain the current viewport for that view.
     * @returns True if the rect changed and the viewport was reconfigured, false if it was already up to date.
     */
    public syncViewportRect({ xr_view, gl_layer }: { xr_view: XRView; gl_layer: XRWebGLLayer }): boolean {
        if (this.#xr_view_eye !== xr_view.eye) {
            throw new Error(`XR view eye mismatch. Expected ${this.#xr_view_eye}, got ${xr_view.eye}`);
        }

        const xr_viewport = gl_layer.getViewport(xr_view);
        if (!xr_viewport) {
            throw new Error(
                `XRViewport could not be obtained from the XRWebGLLayer for eye ${this.#xr_view_eye}. This may indicate an issue with the XR session or device.`,
            );
        }

        const current = this.#xr_viewport;
        if (
            current.width === xr_viewport.width &&
            current.height === xr_viewport.height &&
            current.x === xr_viewport.x &&
            current.y === xr_viewport.y
        ) {
            return false;
        }

        console.debug(
            `XR viewport rect changed for eye ${this.#xr_view_eye}. Previous: ${JSON.stringify(current)}, new: ${JSON.stringify(xr_viewport)}`,
        );

        const { x, y, width, height } = xr_viewport;
        this.#xr_viewport = { x, y, width, height };
        this.viewport.relative_rect = this.#computeRelativeRect({ xr_viewport, gl_layer });

        return true;
    }

    /**
     * Create camera entity for XR view and add to hierarchy.
     *
     * @param dataJSON Optional JSON data to include in the camera component for configuring the render graph.
     * @param perspective_lens The perspective lens to use for the camera projection.
     */
    public async createCamera({
        dataJSON,
        perspective_lens,
    }: {
        dataJSON?: RenderGraphDataObject;
        perspective_lens: Components.PerspectiveLens;
    }): Promise<Entity> {
        const { viewport } = this;

        // Create camera entity
        const camera_entity = await this.#livelink.scene.newEntity({
            name: `xr_camera_${this.#xr_view_eye}`,
            components: {
                local_transform: {},
                perspective_lens,
                camera: { renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392", dataJSON },
                tags: {
                    value: [
                        `viewport_x = ${this.xr_viewport.x.toString() || "?"}`,
                        `viewport_y = ${this.xr_viewport.y.toString() || "?"}`,
                        `viewport_width = ${this.xr_viewport.width.toString() || "?"}`,
                        `viewport_height = ${this.xr_viewport.height.toString() || "?"}`,
                        `recommended_scale = ${this.#xr_recommended_viewport_scale?.toString() || "?"}`,
                    ],
                },
            },
            options: { delete_on_client_disconnection: true, auto_broadcast: false },
        });

        // Set viewport camera projection
        viewport.camera_projection = new CameraProjection({ camera_entity, viewport: viewport });

        console.debug(`Created camera entity for ${this.#xr_view_eye} eye:`, camera_entity);

        return camera_entity;
    }

    /**
     * Get the latest remote transform of the camera entity associated with this viewport.
     *
     * @returns The position and orientation of the camera, in a scratch object owned by this
     * viewport and overwritten on the next call. Valid for the current frame only.
     */
    public getCameraRemoteTransform(): { position: Vec3; orientation: Quat } {
        const camera_projection = this.viewport?.camera_projection;
        if (!camera_projection) {
            throw new Error(`Missing camera projection for ${this.#xr_view_eye} eye`);
        }

        const { position, orientation } = this.#remote_transform_scratch;
        const { world_position, world_orientation } = camera_projection;
        position[0] = world_position[0];
        position[1] = world_position[1];
        position[2] = world_position[2];
        orientation[0] = world_orientation[0];
        orientation[1] = world_orientation[1];
        orientation[2] = world_orientation[2];
        orientation[3] = world_orientation[3];

        return this.#remote_transform_scratch;
    }

    /**
     * Update the camera's local transform based on the latest XR view data. The camera's position is updated with the
     * IPD offset from the center eye, while the orientation remains identity since the pose entity already has the XR
     * device rotation. This method should be called on each XR frame to ensure that the camera stays in sync with the
     * user's head movements.
     *
     * @param xr_view The XR view containing the current transform and lens information for the camera.
     * @param center_eye_position The position of the center eye, used to compute the IPD offset for the camera's local transform.
     * @param center_eye_orientation_conjugate The conjugate of the center eye's orientation, used to rotate the IPD offset into head-local space for the camera's local transform.
     * @returns The camera entity whose transform was updated.
     */
    public updateCamera({
        xr_view,
        center_eye_position,
        center_eye_orientation_conjugate,
    }: {
        xr_view: XRView;
        center_eye_position: Vector3;
        center_eye_orientation_conjugate: Quaternion;
    }): Entity {
        // Update each camera with its IPD offset from center eye and perspective lens
        const camera = this.viewport.camera_projection?.camera_entity;
        if (!camera) {
            throw new Error(`Camera for eye ${xr_view.eye} not found`);
        }

        // Compute IPD offset in tracking space, then rotate into head-local space.
        // xr_view.transform.position and center_eye_position are both in XR tracking space.
        // Since the camera is a child of pose_entity (which carries center eye orientation),
        // the offset must be in head-local space to avoid double-rotating.
        const { position } = xr_view.transform;
        const ipd_offset = new Vector3(
            position.x - center_eye_position.x,
            position.y - center_eye_position.y,
            position.z - center_eye_position.z,
        ).applyQuaternion(center_eye_orientation_conjugate);

        // Camera gets static IPD offset from center eye
        // Orientation is identity because pose_entity already has the XR device rotation
        camera.local_transform = {
            position: [ipd_offset.x, ipd_offset.y, ipd_offset.z] as Vec3,
            // Identity - parent pose_entity has the rotation
            orientation: [0, 0, 0, 1],
        };

        return camera;
    }

    /**
     * Remove livelink viewport
     */
    public release(): void {
        if (this.viewport) {
            this.#livelink.removeViewport({ viewport: this.viewport });
            const camera_entity = this.viewport.camera_projection?.camera_entity;
            if (camera_entity) {
                this.#livelink.scene.deleteEntities({ entities: [camera_entity] });
            }
        }
    }
}
