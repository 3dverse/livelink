//------------------------------------------------------------------------------
import { glMatrix, mat3, mat4, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import type { Components, Mat4, Quat, Vec2, Vec3 } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Entity } from "../scene/Entity";
import { Viewport } from "./Viewport";
import { FrameCameraTransform } from "./decoders/FrameCameraTransform";

/**
 *
 */
const INFINITE_FAR_VALUE = 100000;

/**
 * A ray in 3D space.
 */
export type Ray = { origin: Vec3; direction: Vec3 };

/**
 * Holds the projection and transform matrices associated to a camera entity.
 *
 * The data in this class is guaranteed to be synchronized with the frame being rendered.
 * It accounts for the delays that occur between the remote server and the client.
 * The data it holds come from the frame meta data that are provided along with the frame sent by the server.
 *
 * As for the transform values in the camera entity, they are not guaranteed to be synchronized
 * with the frame being rendered. This is because the camera entity can be updated at any time,
 * and might be too recent to be used in the current frame.
 *
 * In short, camera controllers should use the camera entity and frame drawers (RenderingSurface, Overlay, ...)
 * should use the CameraProjection.
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
     * Transformation matrix from view space to world space, aka the inverse of the view matrix.
     */
    #world_from_view_matrix = mat4.create();

    /**
     * Transformation matrix from view space to clip space, aka the projection matrix.
     */
    get clip_from_view_matrix(): Readonly<Mat4> {
        return this.#clip_from_view_matrix as Mat4;
    }

    /**
     * Transformation matrix from world space to clip space, aka the model-view-projection matrix.
     */
    get clip_from_world_matrix(): Readonly<Mat4> {
        return this.#clip_from_world_matrix as Mat4;
    }

    /**
     * Transformation matrix from clip space to world space, aka the inverse of model-view-projection matrix.
     */
    get world_from_clip_matrix(): Readonly<Mat4> {
        return mat4.invert(mat4.create(), this.#clip_from_world_matrix) as Mat4;
    }

    /**
     * Transformation matrix from view space to world space, aka the inverse of the view matrix.
     */
    get world_from_view_matrix(): Readonly<Mat4> {
        return this.#world_from_view_matrix as Mat4;
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
     * Projects a clip space position to world space.
     *
     * @param param
     * @param param.clip_position - The position in clip space to project.
     * @param param.out_world_position - The output position in world space.
     *
     * @returns The position in world space.
     */
    projectClipToWorld({
        clip_position,
        out_world_position = vec3.create() as Vec3,
    }: {
        clip_position: Vec3;
        out_world_position?: Vec3;
    }): Vec3 {
        vec3.transformMat4(out_world_position, clip_position, this.world_from_clip_matrix);
        return out_world_position as Vec3;
    }

    /**
     * Computes a ray from the camera origin to the given screen coordinates.
     * (0, 0) is the top-left corner of the viewport, (1, 1) is the bottom-right corner.
     *
     * @param param
     * @param param.screen_position - The screen coordinates to compute the ray from.

     * @returns The ray.
     */
    computeRayFromScreenPosition({ screen_position }: { screen_position: Vec2 }): Ray {
        const clip_position = this.#screenPositionToClipPosition({ screen_position });
        return this.computeRayFromClipPosition({ clip_position });
    }

    /**
     * Computes a ray from the camera origin to the given clip coordinates.
     * (-1, -1) is the bottom-left corner of the viewport, (1, 1) is the top-right corner.
     *
     * @param param
     * @param param.clip_position - The clip coordinates to compute the ray from.
     *
     * @returns The ray.
     */
    computeRayFromClipPosition({ clip_position }: { clip_position: Vec3 }): Ray {
        if (this.camera_entity.perspective_lens) {
            return this.#computeRayWithPerspectiveProjection({ clip_position });
        } else if (this.camera_entity.orthographic_lens) {
            return this.#computeRayWithOrthographicProjection({
                lens: this.camera_entity.orthographic_lens,
                clip_position,
            });
        } else {
            throw new Error("Camera entity must have a perspective or orthographic lens component");
        }
    }

    /**
     * Computes a ray from the camera origin to the given screen coordinates using perspective projection.
     *
     * @param param
     * @param param.clip_position - The screen coordinates to compute the ray from.
     *
     * @returns The ray.
     */
    #computeRayWithPerspectiveProjection({ clip_position }: { clip_position: Vec3 }): Ray {
        const ray: Ray = {
            origin: vec3.fromValues(...this.#world_position) as Vec3,
            direction: vec3.create() as Vec3,
        };

        this.projectClipToWorld({ clip_position, out_world_position: ray.direction });

        vec3.sub(ray.direction, ray.direction, ray.origin);
        vec3.normalize(ray.direction, ray.direction);

        return ray;
    }

    /**
     * Computes a ray from the camera origin to the given screen coordinates using orthographic projection.
     *
     * @param param
     * @param param.clip_position - The screen coordinates to compute the ray from.
     *
     * @returns The ray.
     */
    #computeRayWithOrthographicProjection({
        lens,
        clip_position,
    }: {
        lens: Components.OrthographicLens;
        clip_position: Vec3;
    }): Ray {
        const { zNear, zFar } = lens;

        const ray: Ray = {
            origin: vec3.fromValues(clip_position[0], clip_position[1], (zNear + zFar) / (zNear - zFar)) as Vec3,
            direction: vec3.fromValues(0, 0, -1) as Vec3,
        };

        this.projectClipToWorld({ clip_position, out_world_position: ray.origin });

        const affinedMatrix = mat3.fromMat4(mat3.create(), this.world_from_view_matrix);
        vec3.transformMat3(ray.direction, ray.direction, affinedMatrix);

        return ray;
    }

    /**
     * Converts a screen position to a clip position.
     *
     * @param param
     * @param param.screen_position - The screen position to convert.
     *
     * @returns The clip position.
     */
    #screenPositionToClipPosition({ screen_position }: { screen_position: Vec2 }): Vec3 {
        return vec3.fromValues(screen_position[0] * 2 - 1, 1 - screen_position[1] * 2, 0.5) as Vec3;
    }

    /**
     * Updates the projection matrix of the camera entity.
     * This method should be called whenever the camera entity or viewport changes.
     */
    updateProjectionMatrix(): void {
        if (this.camera_entity.perspective_lens) {
            this.#computePerspectiveProjection({ lens: this.camera_entity.perspective_lens });
        } else if (this.camera_entity.orthographic_lens) {
            this.#computeOrthographicProjection({ lens: this.camera_entity.orthographic_lens });
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
        this.#world_from_view_matrix = Array.from(frame_camera_transform.world_from_view_matrix) as Mat4;

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
    #computePerspectiveProjection({ lens }: { lens: Components.PerspectiveLens }): void {
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
    #computeOrthographicProjection({ lens }: { lens: Components.OrthographicLens }): void {
        mat4.ortho(this.#clip_from_view_matrix, lens.left, lens.right, lens.bottom, lens.top, lens.zNear, lens.zFar);
    }
}
