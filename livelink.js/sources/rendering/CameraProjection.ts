//------------------------------------------------------------------------------
import { glMatrix, mat4, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import type { Components, Mat4, Quat, Vec3 } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Entity } from "../scene/Entity";
import { Viewport } from "./Viewport";
import { FrameCameraTransform } from "./decoders/FrameCameraTransform";

/**
 *
 */
const INFINITE_FAR_VALUE = 100000;

/**
 * Holds the projection matrix of a camera entity.
 *
 * @category Rendering
 */
export class CameraProjection {
    /**
     * The entity that holds the camera and lens components.
     */
    readonly camera_entity: Entity;

    /**
     * The viewport in which the camera is rendered.
     */
    readonly viewport: Viewport;

    /**
     * World space position of the camera as used by the currently processed frame.
     */
    #world_position: Vec3 = [0, 0, 0];

    /**
     * World space orientation of the camera as used by the currently processed frame.
     */
    #world_orientation: Quat = [1, 0, 0, 0];

    /**
     * Transformation matrix from view space to clip space, aka the projection matrix.
     */
    #clip_from_view_matrix = mat4.create();

    /**
     * Transformation matrix from world space to clip space, aka the model-view-projection matrix.
     */
    #clip_from_world_matrix = mat4.create();

    /**
     * Transformation matrix from view space to clip space, aka the projection matrix.
     */
    get clip_from_view_matrix(): Mat4 {
        return this.#clip_from_view_matrix as Mat4;
    }

    /**
     * Transformation matrix from world space to clip space, aka the model-view-projection matrix.
     */
    get clip_from_world_matrix(): Mat4 {
        return this.#clip_from_world_matrix as Mat4;
    }

    /**
     * World space position of the camera as used to render the currently processed frame.
     */
    get world_position(): Readonly<Vec3> {
        return this.#world_position;
    }

    /**
     * World space orientation of the camera as used to render the currently processed frame.
     */
    get world_orientation(): Readonly<Quat> {
        return this.#world_orientation;
    }

    /**
     * Creates a new CameraProjection instance for the given camera entity and viewport.
     *
     * @param params - The parameters for the CameraProjection instance.
     * @param params.camera_entity - The entity that holds the camera and lens components.
     * @param params.viewport - The viewport in which the camera is rendered.
     *
     * @throws Error if the camera entity does not have a camera or lens component.
     */
    constructor({ camera_entity, viewport }: { camera_entity: Entity; viewport: Viewport }) {
        this.#checkCameraEntityValidity({ camera_entity });

        this.camera_entity = camera_entity;
        this.viewport = viewport;

        this.updateProjectionMatrix();
        camera_entity.addEventListener("entity-updated", this.#onEntityUpdated);
    }

    /**
     *
     */
    #onEntityUpdated = (): void => {
        this.updateProjectionMatrix();
    };

    /**
     *
     */
    #checkCameraEntityValidity({ camera_entity }: { camera_entity: Entity }): void {
        if (!camera_entity.camera) {
            throw new Error("Camera entity must have a camera component");
        }

        if (!camera_entity.perspective_lens && !camera_entity.orthographic_lens) {
            throw new Error("Camera entity must have a perspective or orthographic lens component");
        }
    }

    /**
     * Projects a world space position to clip space.
     *
     * @param params
     * @param params.world_position - The position in world space to project.
     * @param params.out_clip_position - The output position in clip space.
     *
     * @returns The position in clip space.
     */
    projectWorldToClip({
        world_position,
        out_clip_position = vec3.create() as Vec3,
    }: {
        world_position: Vec3;
        out_clip_position?: Vec3;
    }): Vec3 {
        vec3.transformMat4(out_clip_position, world_position, this.#clip_from_world_matrix);
        return out_clip_position as Vec3;
    }

    /**
     * Updates the projection matrix of the camera entity.
     * This method should be called whenever the camera entity or viewport changes.
     */
    updateProjectionMatrix(): void {
        if (this.camera_entity.perspective_lens) {
            this.#computePerspectiveProjection();
        } else if (this.camera_entity.orthographic_lens) {
            this.#computeOrthographicProjection();
        }
    }

    /**
     * @internal
     *
     * Updates the transformation matrix from world space to clip space.
     *
     * @param params
     * @param params.frame_camera_transform - The frame camera transform data as found in the frame metadata.
     */
    updateFromFrameCameraTransform({ frame_camera_transform }: { frame_camera_transform: FrameCameraTransform }): void {
        this.#world_position = frame_camera_transform.world_position;
        this.#world_orientation = frame_camera_transform.world_orientation;

        const tmp_matrix = this.#clip_from_world_matrix;
        const view_from_world_matrix = mat4.invert(tmp_matrix, frame_camera_transform.world_from_view_matrix);

        this.#clip_from_world_matrix = mat4.multiply(
            this.#clip_from_world_matrix,
            this.#clip_from_view_matrix,
            view_from_world_matrix,
        );
    }

    /**
     *
     */
    #computePerspectiveProjection(): void {
        const lens = this.camera_entity.perspective_lens as Required<Components.PerspectiveLens>;
        mat4.perspective(
            this.#clip_from_view_matrix,
            glMatrix.toRadian(lens.fovy),
            this.viewport.aspect_ratio,
            lens.nearPlane,
            lens.farPlane || INFINITE_FAR_VALUE,
        );
    }

    /**
     *
     */
    #computeOrthographicProjection(): void {
        const lens = this.camera_entity.orthographic_lens as Required<Components.OrthographicLens>;
        mat4.ortho(this.#clip_from_view_matrix, lens.left, lens.right, lens.bottom, lens.top, lens.zNear, lens.zFar);
    }
}
